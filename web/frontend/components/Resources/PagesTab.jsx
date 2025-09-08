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
} from "@shopify/polaris";

export default function PagesTab() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

  // state cho edit
  const [selectedPage, setSelectedPage] = useState(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [titleSuggestion, setTitleSuggestion] = useState("");
  const [bodySuggestion, setBodySuggestion] = useState("");

  // Toast state
  const [toastContent, setToastContent] = useState("");
  const [toastError, setToastError] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    fetch("/api/admin/resources/pages")
      .then((res) => res.json())
      .then((data) => setPages(data.pages || []))
      .catch((err) => {
        console.error("❌ Failed to load pages:", err);
        setPages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // --- handle edit ---
  const handleEdit = (page) => {
    setSelectedPage(page);
    setTitle(page.title || "");
    setBody(page.bodySummary || "");
    setTitleSuggestion("");
    setBodySuggestion("");
  };

  const handleClose = () => {
    setSelectedPage(null);
    setTitle("");
    setBody("");
    setTitleSuggestion("");
    setBodySuggestion("");
  };

  // --- handle save ---
  const handleSave = async () => {
    try {
      const resp = await fetch(`/api/admin/resources/pages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selectedPage.id,
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
        console.log("✅ Update success:", data.page);
        setToastContent("Page updated successfully");
        setToastError(false);
        setShowToast(true);

        setPages((prev) =>
          prev.map((p) =>
            p.id === selectedPage.id ? { ...p, title, bodySummary: body } : p
          )
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

  // --- handle AI suggest ---
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

  // --- apply suggestion ---
  const applySuggestion = () => {
    if (titleSuggestion) setTitle(titleSuggestion);
    if (bodySuggestion) setBody(bodySuggestion);
    setToastContent("✅ Applied AI suggestions");
    setToastError(false);
    setShowToast(true);
  };

  if (loading) return <Spinner accessibilityLabel="Loading pages" />;

  return (
    <Frame>
      <Box padding="400" display="grid" gap="300">
        {pages.map((p) => (
          <Card key={p.id} sectioned>
            <Stack alignment="center" distribution="equalSpacing">
              <Stack.Item fill>
                <Box>
                  <Text variant="headingMd" as="h3">{p.title}</Text>
                  <Text tone="subdued">
                    {p.bodySummary
                      ? p.bodySummary.slice(0, 80) + "..."
                      : "No summary"}
                  </Text>
                </Box>
              </Stack.Item>

              <Button primary onClick={() => handleEdit(p)}>
                Edit
              </Button>
            </Stack>
          </Card>
        ))}

        {selectedPage && (
          <Modal
            open={!!selectedPage}
            onClose={handleClose}
            title={`Edit ${selectedPage.title}`}
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
      </Box>
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
