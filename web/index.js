// @ts-check
import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";

import shopify from "./shopify.js";
import productCreator from "./backend/product-creator.js";
import PrivacyWebhookHandlers from "./privacy.js";
import shopRouter from "./backend/shop.js";
import { connectDatabase } from "./backend/dbSample.js";
import saveCommentProduct from "./backend/saveCommentProduct.js";
import authRouter, { authMiddleware } from "./backend/admin/auth.js";
import storeRouter from "./backend/admin/stores.js";
import Store from "./models/Store.js";
import productRouter from "./backend/admin/productslist.js";
import filesApi from "./backend/admin/files.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(shopify.config.auth.callbackPath, shopify.auth.callback(), async (req, res) => {
  const session = res.locals.shopify.session;

  // Lấy thông tin shop
  const client = new shopify.api.clients.Rest({ session });
  const shopInfo = await client.get({ path: "shop" });
  const shopData = shopInfo.body.shop;

  // Lưu hoặc cập nhật offline token
  await Store.findOneAndUpdate(
    { shop: shopData.name },
    {
      shop: shopData.name,
      name: shopData.name,
      email: shopData.email,
      domain: shopData.domain,
      myshopify_domain: shopData.myshopify_domain,
      accessToken: session.accessToken, // offline token
      installedAt: new Date(),
      shopID: shopData.id,
    },
    { upsert: true, new: true }
  );

  // Redirect về frontend dashboard
  return res.redirect("/admin/store");
});
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: PrivacyWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js


app.use(express.json()); 
app.use("/api/admin", authRouter);
app.use("/api/admin/stores", storeRouter); // danh sách store
app.use("/api/admin/productslist", productRouter);
app.use("/api/admin/files", shopify.validateAuthenticatedSession(),filesApi);
    

app.use("/api", shopify.validateAuthenticatedSession(), shopRouter);

app.use("/api", shopify.validateAuthenticatedSession(), saveCommentProduct);




app.get("/api/products/count", async (_req, res) => {
  const client = new shopify.api.clients.Graphql({
    session: res.locals.shopify.session,
  });

  const countData = await client.request(`
    query shopifyProductCount {
      productsCount {
        count
      }
    }
  `);

  res.status(200).send({ count: countData.data.productsCount.count });
});

app.post("/api/products", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  res.status(status).send({ success: status === 200, error });
});

app.get("/api/products/list", async (req, res) => {
  try {
    const client = new shopify.api.clients.Graphql({
      session: res.locals.shopify.session,
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

    const products = response.data.products.edges.map((edge) => ({
      id: edge.node.id,
      title: edge.node.title,
    }));

    res.status(200).json(products);
  } catch (e) {
    console.error("❌ Failed to fetch products:", e);
    res.status(500).json({ error: e.message });
  }
});


app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

// ⚡ Serve standalone path /admin/*
app.get("/admin/*", async (_req, res) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html")).toString()
        // Không cần replace API_KEY vì UI này không embed trong Shopify
    );
});


app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(
      readFileSync(join(STATIC_PATH, "index.html"))
        .toString()
        .replace("%VITE_SHOPIFY_API_KEY%", process.env.SHOPIFY_API_KEY || "")
    );
});

async function startServer() { 
  await connectDatabase(); // ✅ gọi DB connect trước 
  app.listen(PORT, () => { 
    console.log(`🚀 Server is running on http://localhost:${PORT}`); 
  }); 
} 

startServer();
