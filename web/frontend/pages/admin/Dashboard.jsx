// src/pages/admin/Dashboard.jsx
import React from "react";
import { Page, Layout, Card, Button, Stack } from "@shopify/polaris";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <Page title="Admin Dashboard">
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <Stack distribution="center" spacing="extraTight">
              {/* Nút Files */}
              <Link to="/admin/files" style={{ textDecoration: "none" }}>
                <Button primary>{t("Files")}</Button>
              </Link>

              {/* Nút Resources */}
              <Link to="/admin/resources" style={{ textDecoration: "none" }}>
                <Button primary>{t("Resources")}</Button>
              </Link>
            </Stack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Giả lập hàm t() nếu chưa dùng i18next
function t(text) {
  return text;
}
