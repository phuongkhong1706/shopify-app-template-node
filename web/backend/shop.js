// web/shop.js
import express from "express";
import shopify from "../shopify.js";
import { connectDatabase } from "./dbSample.js";
import Store from "../models/Store.js";

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
          ianaTimezone
          currencyCode
          createdAt
          primaryDomain { 
            url
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
      country: shop.country,
      customer_email: shop.contactEmail,
      myshopify_domain: shop.myshopifyDomain,
      plan_display_name: shop.plan?.displayName || "",
      iana_timezone: shop.ianaTimezone,
      currency: shop.currencyCode,
      address1: shop.address1 || "",
      address2: shop.address2 || "",
      phone: shop.phone || "",
      shop_created_at: shop.createdAt,// ĐÂY LÀ PHẦN QUAN TRỌNG: LƯU ACCESS TOKEN VÀO DB
      accessToken: session.accessToken,
      // Nếu bạn sử dụng offline access mode và có refresh token, hãy lưu nó ở đây:
      refreshToken: session.refreshToken || null, // Kiểm tra nếu session có refreshToken
      accessTokenCreatedAt: session.accessTokenExpiresAt
        ? new Date(session.accessTokenExpiresAt - 3600 * 1000) // Online token, có expiresAt
        : new Date(), // Offline token → coi thời điểm hiện tại là createdAt
      // Ví dụ: nếu expiresAt là 1h sau tạo
      accessTokenExpiresAt: session.accessTokenExpiresAt
        ? new Date(session.accessTokenExpiresAt)
        : null,
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
