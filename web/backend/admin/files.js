import express from "express";
import shopify from "../../shopify.js";
import fetch from "node-fetch";
import sharp from "sharp";
import ShopImage from "../../models/ShopImages.js";
import { Blob } from "buffer";
import FormData from "form-data";


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

    // ✅ Lưu vào MongoDB
    await ShopImage.create({
      shop: res.locals.shopify.session.shop,
      sourceType: "optimized",  // hoặc "upload" tuỳ trường hợp
      originalMediaImageId: node.id,
      originalUrl: node.image.url,
      mediaImageId: optimizedFile.id,
      url: optimizedFile.image?.url,
      width: optimizedFile.image?.width,
      height: optimizedFile.image?.height,
      size: optimizedBuffer.length,
      filename: `optimized-${id}.jpg`,
    });
    console.log("✅ Lưu ShopImage vào DB thành công");
    
    // ✅ Lấy metafield cũ (optimized_images)
const existing = await client.query({
  data: {
    query: `
      query getShopMetafield($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            value
          }
        }
      }
    `,
    variables: { namespace: "optimized_files", key: "optimized_images" },
  },
});

let mapping = {};
const current = existing.body.data.shop.metafield;
if (current?.value) {
  try {
    mapping = JSON.parse(current.value);
  } catch (e) {
    console.warn("⚠️ Không parse được metafield JSON:", e);
  }
}

// ✅ Cập nhật mapping mới
mapping[node.image.url] = optimizedFile.image?.url;

// Lấy globalId của shop
const shopResp = await client.query({
  data: `query { shop { id } }`,
});
const shopId = shopResp.body.data.shop.id;

// ✅ Ghi lại metafield JSON
const metafieldResp = await client.query({
  data: {
    query: `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { key namespace type value }
          userErrors { field message }
        }
      }
    `,
    variables: {
      metafields: [
        {
          namespace: "files",
          key: "optimized_images",
          type: "json",
          value: JSON.stringify(mapping),
          ownerId: shopId, // shop
        },
      ],
    },
  },
});

if (metafieldResp.body.data.metafieldsSet.userErrors.length > 0) {
  console.error("❌ Lỗi khi lưu metafield:", metafieldResp.body.data.metafieldsSet.userErrors);
} else {
  console.log("✅ Lưu metafield JSON thành công");
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

/**
 * POST /api/admin/files/upload
 * Upload file mới từ client lên Shopify
 */
router.post("/upload", shopify.validateAuthenticatedSession(), async (req, res) => {
  try {
    console.log("=== Upload Debug ===");
    console.log("Headers:", req.headers["content-type"]);
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);
    console.log("====================");

    if (!req.files || !req.files.file) {
      return res.status(400).json({ success: false, message: "Thiếu file trong request (field name phải là 'file')" });
    }

    const file = req.files.file;
    console.log("📂 Nhận file:", file.name, file.mimetype, file.size);

    const client = new shopify.api.clients.Graphql({ session: res.locals.shopify.session });

    // 1️⃣ stagedUploadsCreate
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
              filename: file.name,
              mimeType: file.mimetype,
              httpMethod: "POST",
              resource: "FILE",
            },
          ],
        },
      },
    });

    const stagedTarget = stagedUploadResp.body?.data?.stagedUploadsCreate?.stagedTargets?.[0];
    if (!stagedTarget) {
      return res.status(500).json({
        success: false,
        message:
          stagedUploadResp.body?.data?.stagedUploadsCreate?.userErrors
            ?.map((e) => e.message)
            .join(", ") || "Không có stagedTargets",
      });
    }

    // 2️⃣ Upload binary lên GCS
    const FormData = (await import("form-data")).default;
    const form = new FormData();
    stagedTarget.parameters.forEach((param) => form.append(param.name, param.value));
    form.append("file", file.data, { filename: file.name, contentType: file.mimetype });

    const s3Resp = await fetch(stagedTarget.url, { method: "POST", body: form });
    if (!s3Resp.ok) {
      const errText = await s3Resp.text();
      throw new Error(`Upload S3/GCS thất bại: ${s3Resp.status} ${s3Resp.statusText}\n${errText}`);
    }
    console.log("✅ Upload S3/GCS thành công");

    // 3️⃣ fileCreate
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
              alt: file.name,
            },
          ],
        },
      },
    });

    const result = fileCreateResp.body.data.fileCreate;
    if (result.userErrors.length > 0) {
      console.error("❌ Lỗi fileCreate:", result.userErrors);
      return res.status(500).json({ success: false, message: result.userErrors.map(e => e.message).join(", ") });
    }

    let uploadedFile = result.files[0];
    if (!uploadedFile.image?.url) {
      console.log("⚠️ fileCreate chưa có image.url, chờ Shopify index...");
      const retryFile = await waitForImage(client, uploadedFile.id, 5, 2000);
      if (retryFile) uploadedFile = retryFile;
    }

    // 4️⃣ Lưu vào MongoDB
    await ShopImage.create({
      shop: res.locals.shopify.session.shop,
      sourceType: "upload",
      mediaImageId: uploadedFile.id,
      url: uploadedFile.image?.url,
      width: uploadedFile.image?.width,
      height: uploadedFile.image?.height,
      size: file.size,
      filename: file.name,
    });
    console.log("✅ Lưu ShopImage vào DB thành công");

    // 5️⃣ Lấy metafield cũ
    const existing = await client.query({
      data: {
        query: `query getShopMetafield {
          shop { id metafield(namespace: "files", key: "uploaded_images") { id value } }
        }`,
      },
    });

    const shopId = existing.body.data.shop.id;
    const current = existing.body.data.shop.metafield;
    let mapping = {};
    if (current?.value) {
      try {
        mapping = JSON.parse(current.value);
      } catch (e) {
        console.warn("⚠️ Không parse được metafield JSON:", e);
      }
    }

    // 6️⃣ Update mapping
    mapping[file.name] = uploadedFile.image?.url;

    const metafieldResp = await client.query({
      data: {
        query: `
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { key namespace type value }
              userErrors { field message }
            }
          }
        `,
        variables: {
          metafields: [
            {
              namespace: "files",
              key: "uploaded_images",
              type: "json",
              value: JSON.stringify(mapping),
              ownerId: shopId,
            },
          ],
        },
      },
    });

    if (metafieldResp.body.data.metafieldsSet.userErrors.length > 0) {
      console.error("❌ Lỗi metafield:", metafieldResp.body.data.metafieldsSet.userErrors);
    } else {
      console.log("✅ Lưu metafield JSON thành công");
    }

    // 7️⃣ Trả kết quả về
    res.json({
      success: true,
      file: {
        id: uploadedFile.id,
        url: uploadedFile.image?.url || null,
        width: uploadedFile.image?.width || null,
        height: uploadedFile.image?.height || null,
        size: file.size,
      },
    });

  } catch (err) {
    console.error("❌ Error uploading file:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


export default router;
