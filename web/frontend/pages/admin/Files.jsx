import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  Spinner,
  EmptyState,
  Banner,
  Button,
  Stack,
} from "@shopify/polaris";

export default function Files() {
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState(null);
  const [optimizingId, setOptimizingId] = useState(null);

  const getNumericIdFromGid = (gid) => gid.split("/").pop();

  async function fetchFiles() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/files");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      console.error("Error fetching files:", err);
      setError("Không thể tải danh sách file từ Shopify.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleOptimize = async (gid) => {
    const fileId = getNumericIdFromGid(gid);
    setOptimizingId(fileId);

    try {
      const resp = await fetch(`/api/admin/files/optimize/${fileId}`, { method: "POST" });
      const data = await resp.json();

      if (data.success) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === gid
              ? {
                  ...f,
                  id: data.file.id, // ID mới
                  image: { ...f.image, url: data.file.url, width: data.file.width, height: data.file.height },
                  size: data.file.size,
                }
              : f
          )
        );
      } else {
        alert("Optimize thất bại: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi khi optimize file");
    } finally {
      setOptimizingId(null);
    }
  };

  return (
    <Page title="Shopify Files">
      <Layout>
        <Layout.Section>
          {loading ? (
            <Spinner accessibilityLabel="Đang tải file" size="large" />
          ) : error ? (
            <Banner status="critical" title="Lỗi tải file">
              <p>{error}</p>
            </Banner>
          ) : files.length === 0 ? (
            <Card>
              <EmptyState
                heading="Chưa có file nào"
                action={{ content: "Upload file trong Shopify Admin", url: "/admin/files" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Danh sách file trống. Hãy upload một số ảnh vào Shopify Files để hiển thị ở đây.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <ResourceList
                resourceName={{ singular: "file", plural: "files" }}
                items={files}
                renderItem={(item) => {
                  const { id, alt, image, fileStatus, size } = item;
                  const numericId = getNumericIdFromGid(id);

                  return (
                    <ResourceItem
                      id={id}
                      media={<Thumbnail source={image?.url || ""} alt={alt || "Image"} />}
                      accessibilityLabel={`Chi tiết cho ${alt || "file"}`}
                    >
                      <Stack alignment="center" distribution="equalSpacing">
                        <Text as="h3" variant="bodyMd" fontWeight="bold">
                          {alt || (image?.url ? image.url.split("/").pop().split("?")[0] : "Unnamed file")}
                        </Text>
                        <div>Status: {fileStatus}</div>
                        <div>Size: {size ? (size / 1024).toFixed(1) : "?"} KB</div>
                        <div>
                          {image?.width} × {image?.height}px
                        </div>
                        <div>
                          <a href={image?.url} target="_blank" rel="noreferrer">
                            View Original
                          </a>
                        </div>

                        <Button
                          primary
                          loading={optimizingId === numericId}
                          onClick={() => handleOptimize(id)}
                        >
                          Optimize
                        </Button>
                      </Stack>
                    </ResourceItem>
                  );
                }}
              />
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}