// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Card, ResourceList, TextStyle } from "@shopify/polaris";

export default function Stores() {
  const [stores, setStores] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    fetch("/api/admin/stores", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => setStores(data))
      .catch(console.error);
  }, []);

  return (
    <Card title="Stores Installed App" sectioned>
      <ResourceList
        items={stores}
        renderItem={(item) => (
          <ResourceList.Item id={item._id}>
            <TextStyle variation="strong">{item.name}</TextStyle> ({item.shop}) - {item.email} - {item.domain}
          </ResourceList.Item>
        )}
      />
    </Card>
  );
}
