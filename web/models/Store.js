import mongoose from "mongoose";

const Schema = mongoose.Schema;

const storeSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  shop: { type: String, required: true },
  domain: { type: String, required: true },
  scope: { type: String, required: true },
  country: { type: String },
  customer_email: { type: String, required: true },
  myshopify_domain: { type: String, required: true },
  plan_display_name: { type: String, required: true },
  iana_timezone: { type: String, required: true },
  currency: { type: String, required: true },
  address1: { type: String, required: true },
  address2: { type: String },
  phone: { type: String, required: true },
  shop_created_at: { type: String, required: true },
  installedAt: { type: Date, default: Date.now },
  // THÊM TRƯỜNG ACCESS TOKEN VÀO ĐÂY
  accessToken: { type: String, required: true }, // RẤT QUAN TRỌNG!
  // THÊM TRƯỜNG REFRESH TOKEN (nếu bạn sử dụng offline access mode với refresh token)
  refreshToken: { type: String },
  // Thời gian access token được tạo/cập nhật
  accessTokenCreatedAt: { type: Date, default: Date.now },
  // Thời gian access token hết hạn (nếu có, thường chỉ áp dụng cho online access token)
  accessTokenExpiresAt: { type: Date },
}, { timestamps: true }); // Thêm timestamps để có createdAt và updatedAt tự động

export default mongoose.models.Store || mongoose.model("Store", storeSchema);
