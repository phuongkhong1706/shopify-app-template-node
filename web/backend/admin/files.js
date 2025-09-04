import express from "express";
import shopify from "../../shopify.js";
import fetch from "node-fetch";
import sharp from "sharp";


const router = express.Router();

/**
 * Hàm retry lấy image.url sau khi fileCreate
 */
async function waitForImage(client, id, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    const resp = await client.query({
      data: {
        query: `query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              id
              image { url width height }
            }
          }
        }`,
        variables: { id },
      },
    });

    const file = resp.body.data.node;
    if (file?.image?.url) return file; // ✅ có url thì return ngay

    console.log(`⏳ Chưa có image.url, retry ${i + 1}/${retries}...`);
    await new Promise(r => setTimeout(r, delay));
  }
  return null; // hết retries vẫn chưa có url
}
/**
 * GET /api/admin/files
 * Lấy danh sách file (ảnh) từ Shopify Files API
 */
router.get("/", shopify.validateAuthenticatedSession(), async (req, res) => {
  try {
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
    });

    const response = await client.query({
      data: `#graphql
        query {
          files(first: 20) {
            edges {
              node {
                ... on MediaImage {
                  id
                  alt
                  fileStatus
                  image {
                    url
                    width
                    height
                  }
                }
              }
            }
          }
        }
      `,
    });

    const files = await Promise.all(
      response.body.data.files.edges.map(async (edge) => {
        const node = edge.node;
        const numericId = node.id.split("/").pop();

        let size = null;
        try {
          const head = await fetch(node.image.url, { method: "HEAD" });
          size = head.headers.get("content-length");
          if (size) size = parseInt(size, 10);
        } catch (e) {
          console.warn("Cannot fetch size for:", node.image.url);
        }

        return { ...node, numericId, size };
      })
    );

    res.status(200).json({ files });
  } catch (err) {
    console.error("Error fetching files:", err);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/**
 * POST /api/admin/files/optimize/:id
 * Optimize 1 file dựa trên numericId
 */
router.post("/optimize/:id", shopify.validateAuthenticatedSession(), async (req, res) => {
  try {
    const { id } = req.params;
    const gid = `gid://shopify/MediaImage/${id}`;

    const client = new shopify.api.clients.Graphql({ session: res.locals.shopify.session });

    // 1️⃣ Lấy thông tin ảnh gốc
    const fileData = await client.query({
      data: {
        query: `query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              id
              image { url width height }
              alt
            }
          }
        }`,
        variables: { id: gid },
      },
    });

    const node = fileData.body.data.node;
    if (!node) return res.status(404).json({ success: false, message: "File not found" });

    console.log("📌 Lấy ảnh gốc:", node.image.url);

    // 2️⃣ Fetch ảnh gốc
    const response = await fetch(node.image.url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!response.ok) return res.status(400).json({ success: false, message: "Cannot fetch original image" });

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log("📌 Kích thước ảnh gốc:", buffer.length, "bytes");

    // 3️⃣ Optimize bằng Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    console.log("✅ Optimize xong, kích thước ảnh:", optimizedBuffer.length, "bytes");

    // 4️⃣ stagedUploadsCreate
    const stagedUploadResp = await client.query({
      data: {
        query: `
          mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
              stagedTargets {
                url
                resourceUrl
                parameters { name value }
              }
              userErrors { field message }
            }
          }
        `,
        variables: {
          input: [
            {
              filename: `optimized-${id}.jpg`,
              mimeType: "image/jpeg",
              httpMethod: "POST",
              resource: "FILE",
            },
          ],
        },
      },
    });

    const stagedResp = stagedUploadResp.body?.data?.stagedUploadsCreate;
    const stagedTarget = stagedResp?.stagedTargets?.[0];
    if (!stagedTarget) {
      console.error("❌ Lỗi stagedUpload:", stagedResp?.userErrors);
      return res.status(500).json({
        success: false,
        message: stagedResp?.userErrors?.map(e => e.message).join(", ") || "Không có stagedTargets",
      });
    }

    // 5️⃣ Upload file binary lên S3
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    stagedTarget.parameters.forEach((param) => {
      form.append(param.name, param.value);
    });
    form.append("file", optimizedBuffer, {
      filename: `optimized-${id}.jpg`,
      contentType: "image/jpeg",
    });

    const s3Resp = await fetch(stagedTarget.url, {
      method: "POST",
      body: form,
    });
    if (!s3Resp.ok) throw new Error(`Upload S3 thất bại: ${s3Resp.statusText}`);

    // 6️⃣ fileCreate
    const fileCreateResp = await client.query({
      data: {
        query: `
          mutation fileCreate($files: [FileCreateInput!]!) {
            fileCreate(files: $files) {
              files {
                ... on MediaImage {
                  id
                  image { url width height }
                }
              }
              userErrors { field message }
            }
          }
        `,
        variables: {
          files: [
            {
              originalSource: stagedTarget.resourceUrl,
              alt: node.alt || "",
            },
          ],
        },
      },
    });

    const result = fileCreateResp.body.data.fileCreate;
    if (result.userErrors.length > 0) {
      console.error("❌ Lỗi khi fileCreate:", result.userErrors);
      return res.status(500).json({ success: false, message: result.userErrors.map(e => e.message).join(", ") });
    }

    let optimizedFile = result.files[0];
    if (!optimizedFile.image?.url) {
      console.log("⚠️ fileCreate chưa có image.url, chờ Shopify index...");
      const retryFile = await waitForImage(client, optimizedFile.id, 5, 2000);
      if (retryFile) optimizedFile = retryFile;
    }

    res.json({
      success: true,
      file: {
        id: optimizedFile.id,
        url: optimizedFile.image?.url || null,
        width: optimizedFile.image?.width || null,
        height: optimizedFile.image?.height || null,
        size: optimizedBuffer.length,
      },
    });

  } catch (err) {
    console.error("Error optimizing file:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
