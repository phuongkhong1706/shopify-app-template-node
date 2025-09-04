// web/backend/admin/files.js
import express from "express";
import shopify from "../../shopify.js";
import fetch from "node-fetch";
import sharp from "sharp";

const router = express.Router();

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

        // Lấy dung lượng ảnh (fetch head)
        let size = null;
        try {
          const head = await fetch(node.image.url, { method: "HEAD" });
          size = head.headers.get("content-length") || null;
          if (size) size = parseInt(size, 10); // bytes
        } catch (e) {
          console.warn("Không thể lấy size:", node.image.url);
        }

        return { ...node, numericId, size };
      })
    );

    res.status(200).json({ files });
  } catch (error) {
    console.error("❌ Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/**
 * POST /api/admin/files/optimize/:id
 * Optimize 1 file dựa trên numericId
 */
// web/backend/admin/files.js
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

    // 2️⃣ Fetch ảnh gốc với User-Agent để tránh lỗi
    const response = await fetch(node.image.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) return res.status(400).json({ success: false, message: "Cannot fetch original image" });
    const buffer = Buffer.from(await response.arrayBuffer());

    // 3️⃣ Optimize bằng Sharp
    const optimizedBuffer = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();

    // 4️⃣ Kiểm tra size
    if (optimizedBuffer.length > 20 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: "File quá lớn (>20MB)" });
    }

    // 5️⃣ Upload lại lên Shopify dưới dạng Base64
    const dataUri = `data:image/jpeg;base64,${optimizedBuffer.toString("base64")}`;
    const uploadResp = await client.query({
      data: {
        query: `mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files { ... on MediaImage { id image { url width height } } }
            userErrors { field message }
          }
        }`,
        variables: {
          files: [{ originalSource: dataUri, alt: node.alt || "" }],
        },
      },
    });

    const userErrors = uploadResp.body.data.fileCreate.userErrors;
    if (userErrors.length > 0) {
      return res.status(500).json({ success: false, message: userErrors.map(e => e.message).join(", ") });
    }

    const optimizedFile = uploadResp.body.data.fileCreate.files[0];
    res.json({
      success: true,
      file: {
        id: optimizedFile.id,
        url: optimizedFile.image.url,
        width: optimizedFile.image.width,
        height: optimizedFile.image.height,
        size: optimizedBuffer.length,
      },
    });

  } catch (err) {
    console.error("❌ Error optimizing file:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});


export default router;
