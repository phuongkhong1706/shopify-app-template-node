// models/ShopImage.js
import mongoose from "mongoose";

const ShopImageSchema = new mongoose.Schema(
  {
    shop: { type: String, index: true },   // shop domain

    // Thông tin nguồn
    sourceType: {
      type: String,
      enum: ["optimized", "upload"],
      required: true,
    },

    // Ảnh gốc (nếu có - optimize)
    originalMediaImageId: { type: String, default: null }, // gid://shopify/MediaImage/...
    originalUrl: { type: String, default: null },

    // Ảnh đã xử lý hoặc upload
    mediaImageId: { type: String, required: true }, // id trên Shopify Files
    url: { type: String, required: true },

    // Metadata
    width: Number,
    height: Number,
    size: Number,
    filename: String,
  },
  { timestamps: true }
);

export default mongoose.models.ShopImage || mongoose.model("ShopImage", ShopImageSchema);
