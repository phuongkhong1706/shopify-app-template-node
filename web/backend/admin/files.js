// web/backend/admin/files.js
import express from "express";
import fetch from "node-fetch";
import sharp from "sharp";
import shopify from "../../shopify.js";

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

    const response = await client.request(`
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
    `);

    const files = response.body.data.files.edges.map((edge) => edge.node);

    res.status(200).json({ files });
  } catch (error) {
    console.error("❌ Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

/**
 * POST /api/admin/files/optimize/:id
 * Resize/Compress ảnh bằng sharp rồi upload lại lên Shopify Files API
 */
router.post(
  "/optimize/:id",
  shopify.validateAuthenticatedSession(),
  async (req, res) => {
    const { id } = req.params;

    try {
      const client = new shopify.api.clients.Graphql({
        session: res.locals.shopify.session,
      });

      // 🔹 Lấy info ảnh theo ID
      const fileRes = await client.request(`
        query {
          node(id: "${id}") {
            ... on MediaImage {
              id
              image {
                url
              }
            }
          }
        }
      `);

      const file = fileRes.body.data.node;
      if (!file || !file.image?.url) {
        return res.status(404).json({ error: "File not found" });
      }

      const imageUrl = file.image.url;

      // 🔹 Download ảnh
      const response = await fetch(imageUrl);
      const buffer = await response.buffer();

      // 🔹 Optimize bằng sharp (resize max width = 1200px, compress JPG quality 70%)
      const optimizedBuffer = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();

      // 🔹 Upload lại lên Shopify Files API
      const uploadRes = await client.request(`
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              alt
              ... on MediaImage {
                image {
                  url
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          files: [
            {
              alt: "Optimized image",
              contentType: "IMAGE",
              originalSource: `data:image/jpeg;base64,${optimizedBuffer.toString("base64")}`,
            },
          ],
        },
      });

      const newFile = uploadRes.body.data.fileCreate.files[0];

      res.status(200).json({
        success: true,
        message: `File ${id} optimized`,
        optimizedFile: newFile,
      });
    } catch (error) {
      console.error("❌ Error optimizing file:", error);
      res.status(500).json({ error: "Failed to optimize file" });
    }
  }
);

export default router;
