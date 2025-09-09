import express from "express";
import shopify from "../../shopify.js";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();


const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * ====== PRODUCTS ======
 */

// ✅ Lấy danh sách product
router.get("/products", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const query = `
      {
        products(first: 20) {
          edges {
            node {
              id
              title
              descriptionHtml
            }
          }
        }
      }
    `;

    const resp = await client.query({ data: query });
    const products = resp.body.data.products.edges.map(e => e.node);

    res.json({ products });
  } catch (err) {
    console.error("❌ Fetch products failed:", err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ✅ Update product
router.post("/products", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { id, title, descriptionHtml } = req.body;

    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const resp = await client.query({
      data: {
        query: mutation,
        variables: { input: { id, title, descriptionHtml } },
      },
    });

    res.json(resp.body.data.productUpdate);
  } catch (err) {
    console.error("❌ Update product failed:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});


/**
 * ====== PAGES (optional) ======
 */
router.get("/pages", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const query = `
      {
        pages(first: 20) {
          edges {
            node {
              id
              title
              bodySummary
            }
          }
        }
      }
    `;
    const resp = await client.query({ data: query });
    const pages = resp.body.data.pages.edges.map(e => e.node);

    res.json({ pages });
  } catch (err) {
    console.error("❌ Fetch pages failed:", err);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});


// POST /api/admin/resources/pages
router.post("/pages", async (req, res) => {
  const { id, title, body } = req.body; // frontend gửi `body` thay vì `bodyHtml`

  if (!id || !title || body === undefined) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const mutation = `
      mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page {
            id
            title
            body
            handle
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const pageInput = { title, body }; // chỉ cập nhật title + body
    const variables = { id, page: pageInput };

    const response = await client.query({ data: { query: mutation, variables } });
    const { pageUpdate } = response.body.data;

    if (pageUpdate.userErrors.length) {
      return res.status(400).json({ success: false, userErrors: pageUpdate.userErrors });
    }

    return res.json({ success: true, page: pageUpdate.page });
  } catch (error) {
    console.error("❌ Update page failed:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});



/**
 * ====== blogs (optional) ======
 */
router.get("/blogs", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });

    const query = `
      query BlogsWithArticles($first: Int!, $articlesFirst: Int!) {
        blogs(first: $first) {
          edges {
            node {
              id
              title
              handle
              articles(first: $articlesFirst) {
                edges {
                  node {
                    id
                    title
                    handle
                    body
                  }
                }
              }
            }
          }
        }
      }
    `;

    const resp = await client.query({
      data: {
        query,
        variables: {
          first: 5,
          articlesFirst: 10,
        },
      },
    });

    // Lấy dữ liệu gốc từ API
    const rawBlogs = resp.body.data.blogs.edges;

    // Chuyển về dạng gọn hơn
    const blogs = rawBlogs.map(edge => {
      const blog = edge.node;
      return {
        id: blog.id,
        title: blog.title,
        handle: blog.handle,
        articles: blog.articles.edges.map(a => ({
          id: a.node.id,
          title: a.node.title,
          handle: a.node.handle,
          body: a.node.body,
        })),
      };
    });
    // Trả dữ liệu về frontend
    res.json({ blogs });
  } catch (err) {
    console.error("❌ Fetch blogs failed:", err);
    res.status(500).json({ error: "Failed to fetch blogs" });
  }
});

router.post("/blogs", async (req, res) => {
  try {
    const session = res.locals.shopify.session;
    const client = new shopify.api.clients.Graphql({ session });
    const { id, title, bodyHtml } = req.body;

    const mutation = `
      mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) {
          article {
            id
            title
            handle
            body
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const resp = await client.query({
      data: {
        query: mutation,
        variables: {
          id,
          article: { title, body: bodyHtml },
        },
      },
    });

    res.json(resp.body.data.articleUpdate);
  } catch (err) {
    console.error("❌ Update article failed:", err);
    res.status(500).json({ error: "Failed to update article" });
  }
});




/**
 * ====== AI Suggestion ======
 */
// routes/admin/resources.js
router.post("/suggest", async (req, res) => {
  try {
    const { title = "", description = "" } = req.body;

    if (!title && !description) {
      return res.status(400).json({ error: "Missing title and description" });
    }

    const prompt = `
Bạn là chuyên gia viết nội dung sản phẩm Shopify.
Hãy gợi ý lại tiêu đề và mô tả cho sản phẩm dưới đây, sao cho:

- Ngắn gọn, rõ ràng, hấp dẫn nhưng vẫn tự nhiên.
- Bám sát đặc điểm, công dụng và nội dung gốc (không bịa đặt).
- Không viết lan man, không viết chung chung.
- Output phải trả về đúng 2 phần:
  TITLE: <tiêu đề gợi ý mới>
  DESCRIPTION: <mô tả gợi ý mới>
- Tuyệt đối không thêm ký hiệu thừa (như \`\`\`, **, --- hoặc markdown).
- Giữ nguyên ngôn ngữ gốc (nếu input là tiếng Việt thì output cũng tiếng Việt).

SẢN PHẨM:
TITLE: ${title}
DESCRIPTION: ${description}
`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    let raw = resp.choices?.[0]?.message?.content || "";
    raw = raw.trim();

    // Tách kết quả thành title và description
    const titleMatch = raw.match(/TITLE:\s*(.+)/i);
    const descMatch = raw.match(/DESCRIPTION:\s*([\s\S]+)/i);

    const suggestedTitle = titleMatch ? titleMatch[1].trim() : "";
    const suggestedDesc = descMatch ? descMatch[1].trim() : "";

    return res.json({
      title: suggestedTitle,
      description: suggestedDesc,
    });
  } catch (err) {
    console.error("❌ Suggest content failed:", err);
    res.status(500).json({ error: "Failed to suggest content" });
  }
});


export default router;
