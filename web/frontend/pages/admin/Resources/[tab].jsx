import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Page, Layout, Card, Tabs } from "@shopify/polaris";

import ProductsTab from "../../../components/Resources/ProductsTab";
import PagesTab from "../../../components/Resources/PagesTab";
import BlogsTab from "../../../components/Resources/BlogsTab";

export default function ResourcesPage() {
  const { tab } = useParams(); // "products" | "pages" | "articles"
  const navigate = useNavigate();

  const tabs = [
    { id: "products", content: "Products", component: <ProductsTab /> },
    { id: "pages", content: "Pages", component: <PagesTab /> },
    { id: "blogs", content: "Blog posts", component: <BlogsTab /> },
  ];

  const currentIndex = tabs.findIndex((t) => t.id === tab);
  const [selected, setSelected] = useState(currentIndex >= 0 ? currentIndex : 0);

  // khi đổi tab thì update URL
  const handleTabChange = (index) => {
    setSelected(index);
    navigate(`/admin/resources/${tabs[index].id}`);
  };

  useEffect(() => {
    if (currentIndex >= 0 && currentIndex !== selected) {
      setSelected(currentIndex);
    }
  }, [tab]);

  return (
    <Page title="Resources">
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange}>
              <Card.Section>{tabs[selected].component}</Card.Section>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
