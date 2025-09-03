// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Card, ResourceList, TextStyle } from "@shopify/polaris";
import { useNavigate } from "react-router-dom";

export default function Stores() {
  const [stores, setStores] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;

    fetch("/api/admin/stores", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => setStores(data))
      .catch(err => console.error("Error fetching stores:", err));
  }, []);

  return (
    <Card title="Stores Installed App" sectioned>
      <ResourceList
        items={stores}
        renderItem={(item) => (
          <ResourceList.Item
            id={item.id}
            onClick={() => {
              console.log("Navigating to product list of shopId:", item.id);
              // Navigate bằng shopId
              navigate(`/admin/product/${item.id}`);
            }}
          >
            <TextStyle variation="strong">{item.name}</TextStyle> ({item.shop}) - {item.email} - {item.domain}
          </ResourceList.Item>
        )}
      />
    </Card>
  );
}
