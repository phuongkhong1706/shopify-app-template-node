import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, ResourceList, TextStyle } from "@shopify/polaris";

export default function Product() {
  const { shopId } = useParams(); // dùng shopID
  console.log("shopId from params:", shopId);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log("Fetching products for shopId:", shopId);

    fetch(`/api/admin/productslist/${shopId}`)
      .then(res => {
        console.log("Response status:", res.status);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log("Products data:", data);
        setProducts(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching products:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading products...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;
  if (!products.length) return <div>No products found</div>;

  return (
    <Card title={`Products of Shop ${shopId}`} sectioned>
      <ResourceList
        items={products}
        renderItem={(item) => (
          <ResourceList.Item id={item.id}>
            <TextStyle variation="strong">{item.title}</TextStyle>
          </ResourceList.Item>
        )}
      />
    </Card>
  );
}
