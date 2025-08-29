// saveCommentProduct.js
import express from "express";
import shopify from "./shopify.js";
import mongoose from "mongoose";

// Mongo Schema
const CommentSchema = new mongoose.Schema({
  productId: String, // Lưu GID hoặc ID số đều được, tùy theo cách bạn muốn query sau này.
  comment: String,
  shopifyProductId: String, // Thêm trường này để lưu ID số Shopify nếu cần
});
const Comment = mongoose.model("Comment", CommentSchema);

const router = express.Router();

// Hàm tiện ích để trích xuất ID số từ GID
const extractShopifyProductId = (gid) => {
  if (gid && typeof gid === 'string') {
    const parts = gid.split('/');
    return parts[parts.length - 1]; // Lấy phần cuối cùng sau dấu '/'
  }
  return null;
};


router.post("/save-comment-product", async (req, res) => {
  try {
    const { productId: productGid, comment } = req.body; // Đổi tên biến để rõ ràng là GID

    if (!productGid || !comment) {
      return res.status(400).json({ error: "productId (GID) and comment are required" });
    }

    const shopifyProductId = extractShopifyProductId(productGid);

    if (!shopifyProductId) {
      return res.status(400).json({ error: "Invalid product ID (GID)" });
    }

    // Lưu vào MongoDB
    const newComment = new Comment({ 
        productId: productGid, // Lưu GID nếu bạn muốn
        comment,
        shopifyProductId, // Lưu ID số nếu bạn muốn dễ dàng query Shopify sau này
    });
    await newComment.save();

    // Đẩy lên Shopify Metafield
    const client = new shopify.api.clients.Rest({ session: res.locals.shopify.session });

    // Shopify REST Admin API cần ID số, không phải GID
    await client.post({
      path: `products/${shopifyProductId}/metafields`, // Sử dụng ID số đã trích xuất
      data: {
        metafield: {
          namespace: "custom",
          key: "comment",
          // Tốt nhất nên dùng type 'json_string' hoặc 'multi_line_text_field' nếu comment dài
          // 'single_line_text_field' có giới hạn ký tự.
          type: "multi_line_text_field", // Hoặc 'single_line_text_field' nếu bạn chắc chắn comment ngắn
          value: comment,
        },
      },
      type: "application/json",
    });

    res.json({ success: true, message: "Comment saved to MongoDB and Shopify metafield" });
  } catch (err) {
    console.error("Error saving comment:", err.response ? err.response.body : err.message); // Log chi tiết lỗi Shopify API nếu có
    res.status(500).json({ error: "Failed to save comment", details: err.message });
  }
});

export default router;