import express from "express";
import Store from "../../models/Store.js";
import shopify from "../../shopify.js";

const router = express.Router();

/**
 * GET /api/admin/productslist/:shopId
 * Trả về danh sách products của shop
 */
router.get("/:shopId", async (req, res) => {
  try {
    const shopId = Number(req.params.shopId); // ép từ string → number
    console.log("🔍 DB query with:", { shopID: shopId, type: typeof shopId });

    const store = await Store.findOne({ id: shopId });
    if (!store) return res.status(404).json({ message: "Store not found" });

    console.log("✅ Found store:", store);

    // Shopify client
    const client = new shopify.api.clients.Graphql({
      session: {
        shop: store.myshopify_domain,
        accessToken: store.accessToken,
        isOnline: false,
      },
    });

    const response = await client.request(`
      query {
        products(first: 20) {
          edges {
            node {
              id
              title
            }
          }
        }
      }
    `);

    const products = response.data.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
    }));

    console.log(`🛒 Products fetched for ${store.myshopify_domain}: ${products.length}`);
    res.json(products);

  } catch (err) {
    console.error("❌ Failed to fetch products:", err.response?.errors || err.message);
    res.status(500).json({ message: err.message });
  }
});


export default router;
