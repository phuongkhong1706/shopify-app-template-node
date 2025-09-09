import { useEffect, useState } from "react";
import {
  Card,
  Text,
  Spinner,
  Box,
  Button,
  Modal,
  FormLayout,
  TextField,
  Stack,
  Toast,
  Frame,
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

  // state cho edit
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [titleSuggestion, setTitleSuggestion] = useState("");
  const [bodySuggestion, setBodySuggestion] = useState("");

  // Toast state
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);
  const [showToast, setShowToast] = useState(false);

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

  // handle edit
  const handleEdit = (article) => {
    setSelectedArticle(article);
    setTitle(article.title || "");
    setBody(article.body ? stripHtml(article.body) : "");
    setTitleSuggestion("");
    setBodySuggestion("");
  };

  const handleClose = () => {
    setSelectedArticle(null);
    setTitle("");
    setBody("");
  };

  // Save
  const handleSave = async () => {
    try {
      const resp = await fetch(`/api/admin/resources/blogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedArticle.id,
          title,
          bodyHtml: body,
        }),
      });

      const data = await resp.json();

      if (data.userErrors?.length) {
        console.error("❌ Update failed:", data.userErrors);
        setToastContent(data.userErrors[0].message);
        setToastError(true);
        setShowToast(true);
      } else {
        console.log("✅ Update success:", data.article);
        setToastContent("Article updated successfully");
        setToastError(false);
        setShowToast(true);

        setBlogs((prev) =>
          prev.map((blog) => ({
            ...blog,
            articles: blog.articles.map((a) =>
              a.id === selectedArticle.id
                ? { ...a, title, body }
                : a
            ),
          }))
        );
        handleClose();
      }
    } catch (err) {
      console.error("❌ Save error:", err);
      setToastContent("❌ Network error");
      setToastError(true);
      setShowToast(true);
    }
  };

  // Suggest
  const handleSuggest = async () => {
    try {
      const resp = await fetch("/api/admin/resources/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: body,
        }),
      });
      const data = await resp.json();

      if (data.title || data.description) {
        setTitleSuggestion(data.title || "");
        setBodySuggestion(data.description || "");
      } else {
        setToastContent("No suggestion received");
        setToastError(true);
        setShowToast(true);
      }
    } catch (err) {
      console.error("❌ Suggest error:", err);
      setToastContent("Failed to fetch suggestion");
      setToastError(true);
      setShowToast(true);
    }
  };

  // Apply suggestion
  const applySuggestion = () => {
    if (titleSuggestion) setTitle(titleSuggestion);
    if (bodySuggestion) setBody(bodySuggestion);
    setToastContent("✅ Applied AI suggestions");
    setToastError(false);
    setShowToast(true);
  };

  if (loading) return <Spinner accessibilityLabel="Loading blogs" />;

  return (
    <Frame>
      <Box padding="400">
        <Stack vertical spacing="loose">
          {blogs.map((blog) => (
            <Card key={blog.id} sectioned>
              <Box padding="400">
                <Text variant="headingLg" as="h2">
                  {blog.title}
                </Text>

                <Divider />

                <Stack vertical spacing="loose">
                  {blog.articles.map((a) => (
                    <Box
                      key={a.id}
                      padding="300"
                      border="subdued"
                      borderRadius="200"
                      background="bg-surface-secondary"
                    >
                      <Stack alignment="center" distribution="equalSpacing">
                        <Stack.Item fill>
                          <Box>
                            <Text variant="headingMd" as="h3">
                              {a.title}
                            </Text>
                            <Text tone="subdued">
                              {a.body
                                ? stripHtml(a.body).slice(0, 100) + "..."
                                : "No content"}
                            </Text>
                          </Box>
                        </Stack.Item>

                        <Button primary onClick={() => handleEdit(a)}>
                          Edit
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Card>
          ))}
        </Stack>
      </Box>

      {selectedArticle && (
        <Modal
          open={!!selectedArticle}
          onClose={handleClose}
          title={`Edit ${selectedArticle.title}`}
          primaryAction={{
            content: "Save",
            onAction: handleSave,
          }}
          secondaryActions={[{ content: "Cancel", onAction: handleClose }]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Title"
                value={title}
                onChange={setTitle}
                autoComplete="off"
              />
              <TextField
                label="Body"
                value={body}
                onChange={setBody}
                multiline={6}
              />
              <Stack spacing="tight">
                <Button onClick={handleSuggest}>AI Suggest</Button>
                {(titleSuggestion || bodySuggestion) && (
                  <Button onClick={applySuggestion}>Apply Suggestion</Button>
                )}
              </Stack>
              {titleSuggestion && (
                <TextField
                  label="AI Suggested Title"
                  value={titleSuggestion}
                  multiline
                  disabled
                />
              )}
              {bodySuggestion && (
                <TextField
                  label="AI Suggested Body"
                  value={bodySuggestion}
                  multiline={6}
                  disabled
                />
              )}
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {showToast && (
        <Toast
          content={toastContent}
          error={toastError}
          onDismiss={() => setShowToast(false)}
        />
      )}
    </Frame>
  );
}
