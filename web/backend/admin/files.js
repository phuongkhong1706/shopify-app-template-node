// web/backend/admin/files.js
import express from "express";
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

    // Gọi GraphQL Files API
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

    const files = response.body.data.files.edges.map((edge) => edge.node);

    res.status(200).json({ files });
  } catch (error) {
    console.error("❌ Error fetching files:", error);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});


export default router;
