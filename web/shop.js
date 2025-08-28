// web/shop.js
import express from "express";
import shopify from "./shopify.js";
import { connectDatabase } from "./dbSample.js";
import Store from "./models/Store.js";

const router = express.Router();

// GET /shop
router.get("/shop", async (req, res) => {
  try {
    // 1. Lấy session Shopify từ middleware
    const session = res.locals.shopify.session;

    // 2. Tạo GraphQL client
    const client = new shopify.api.clients.Graphql({ session });

    // 3. GraphQL query
    const query = `
      query shopInfo {
        shop {
          id
          name
          email
          myshopifyDomain
          contactEmail
          plan {
            displayName
          }
          billingAddress {
            address1
            address2
            city
            country
            zip
            phone
          }
        }
      }
    `;

    // 4. Gửi query đến Shopify
    const response = await client.query({ data: query });
    const shop = response.body.data.shop;

    // 5. Kết nối MongoDB

    // 6. Map dữ liệu để lưu MongoDB
    const shopData = {
      id: parseInt(shop.id.replace("gid://shopify/Shop/", "")), // convert từ gid://
      name: shop.name,
      email: shop.email || shop.contactEmail,
      shop: shop.name,
      domain: shop.primaryDomain?.url || "",
      scope: "", // Shopify GraphQL không có field này, bạn có thể set khi cài app
      country: shop.countryCode,
      customer_email: shop.contactEmail,
      myshopify_domain: shop.myshopifyDomain,
      plan_name: shop.plan?.name || "",
      plan_display_name: shop.plan?.displayName || "",
      shop_owner: shop.shopOwner,
      iana_timezone: shop.ianaTimezone,
      currency: shop.currencyCode,
      address1: shop.address1 || "",
      address2: shop.address2 || "",
      phone: shop.phone || "",
      created_at: shop.createdAt,
    };

    // 7. Lưu hoặc update vào MongoDB
    const store = await Store.findOneAndUpdate(
      { id: shopData.id },
      { $set: shopData },
      { upsert: true, new: true }
    );

    // 8. Trả dữ liệu cho frontend
    res.status(200).json(store);
  } catch (error) {
    console.error("Error fetching shop info:", error);
    res.status(500).send({ error: "Failed to fetch shop info" });
  }
});

export default router;
