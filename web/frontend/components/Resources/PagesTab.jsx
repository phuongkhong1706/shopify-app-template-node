import { useEffect, useState } from "react";
import { Card, Text, Spinner, Box } from "@shopify/polaris";

export default function PagesTab() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <Spinner accessibilityLabel="Loading pages" />;

  return (
    <Box gap="300">
      {pages.map((p) => (
        <Card key={p.id} sectioned>
          <Text variant="headingMd" as="h3">{p.title}</Text>
          <Text tone="subdued">
            {p.bodySummary ? p.bodySummary.slice(0, 80) + "..." : "No summary"}
          </Text>
        </Card>
      ))}
    </Box>
  );
}
