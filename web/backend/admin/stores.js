// backend/admin/store.js
import express from "express";
import Store from "../../models/Store.js";
import { authMiddleware } from "./auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const stores = await Store.find({}, { shop: 1, name: 1, email: 1, installedAt: 1, domain: 1 });
    res.json(stores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Cannot fetch stores" });
  }
});

export default router;
