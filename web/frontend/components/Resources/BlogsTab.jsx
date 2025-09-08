import { useEffect, useState } from "react";
import {
  Card,
  Text,
  Spinner,
  Box,
  Stack,
  Divider,
} from "@shopify/polaris";

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

export default function BlogsTab() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/resources/blogs")
      .then((res) => res.json())
      .then((data) => setBlogs(data.blogs || []))
      .catch((err) => {
        console.error("❌ Failed to load blogs:", err);
        setBlogs([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner accessibilityLabel="Loading blogs" />;

  return (
    <Box padding="400">
      <Stack vertical spacing="loose">
        {blogs.map((blog) => (
          <Card key={blog.id} sectioned>
            <Box padding="400">
              {/* Blog title */}
              <Text variant="headingLg" as="h2">
                {blog.title}
              </Text>

              <Divider />

              {/* Articles */}
              <Stack vertical spacing="loose">
                {blog.articles.map((a) => (
                  <Box
                    key={a.id}
                    padding="300"
                    border="subdued"
                    borderRadius="200"
                    background="bg-surface-secondary"
                  >
                    <Text variant="headingMd" as="h3">
                      {a.title}
                    </Text>
                    <Text tone="subdued">
                      {a.body
                        ? stripHtml(a.body).slice(0, 100) + "..."
                        : "No content"}
                    </Text>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
