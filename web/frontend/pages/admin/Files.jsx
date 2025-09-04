// web/frontend/pages/Files.jsx
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
    const [optimizing, setOptimizing] = useState(null); // id ảnh đang optimize

    async function fetchFiles() {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/files");

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();
            setFiles(data.files || []);
        } catch (err) {
            console.error("❌ Error fetching files:", err);
            setError("Không thể tải danh sách file từ Shopify.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchFiles();
    }, []);

    async function handleOptimize(id) {
        setOptimizing(id);
        try {
            const res = await fetch(`/api/admin/files/optimize/${id}`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                alert(`✅ Ảnh đã optimize!`);
                await fetchFiles(); // reload list
            } else {
                alert("❌ Optimize thất bại");
            }
        } catch (err) {
            console.error("Optimize error:", err);
            alert("❌ Lỗi khi optimize");
        } finally {
            setOptimizing(null);
        }
    }

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
                                    const { id, alt, image, fileStatus } = item;
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
                                                    size="slim"
                                                    loading={optimizing === id}
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
