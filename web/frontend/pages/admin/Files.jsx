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
    const [uploading, setUploading] = useState(false);

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
                    prev.map((file) =>
                        getNumericIdFromGid(file.id) === fileId
                            ? {
                                ...file,
                                id: data.file.id, // cập nhật id optimized mới
                                image: {
                                    url: data.file.url,
                                    width: data.file.width,
                                    height: data.file.height,
                                },
                                size: data.file.size,
                            }
                            : file
                    )
                );
            }
            else {
                alert("Optimize thất bại: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Lỗi khi optimize file");
        } finally {
            setOptimizingId(null);
        }
    };

    const handleUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            const resp = await fetch("/api/admin/files/upload", {
                method: "POST",
                body: formData,
            });
            const data = await resp.json();

            if (data.success) {
                // thêm file mới vào danh sách
                setFiles((prev) => [
                    ...prev,
                    {
                        id: data.file.id,
                        image: {
                            url: data.file.url,
                            width: data.file.width,
                            height: data.file.height,
                        },
                        size: data.file.size,
                    },
                ]);
            } else {
                alert("Upload thất bại: " + data.message);
            }
        } catch (err) {
            console.error(err);
            alert("Lỗi khi upload file");
        } finally {
            setUploading(false);
        }
    };


    return (
        <Page title="Shopify Files">
            <Layout>
                <Layout.Section>
                    <Stack alignment="center" distribution="equalSpacing">
                        <Text as="h2" variant="headingMd">Danh sách File</Text>
                        <div>
                            <Button

                                loading={uploading}
                                onClick={() => document.getElementById("fileInput").click()}
                            >
                                Upload File
                            </Button>
                            <input
                                type="file"
                                id="fileInput"
                                style={{ display: "none" }}
                                accept="image/*"
                                onChange={handleUpload}
                            />
                        </div>
                    </Stack>
                </Layout.Section>
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
                                    const { id, alt, image, size } = item;
                                    const numericId = getNumericIdFromGid(id);

                                    return (
                                        <ResourceItem
                                            id={id}
                                            media={<Thumbnail source={image?.url || ""} alt={alt || "Image"} />}
                                            accessibilityLabel={`Chi tiết cho ${alt || "file"}`}
                                        >
                                            <Stack alignment="center" distribution="equalSpacing">
                                                {/* Bên trái: thông tin file */}
                                                <Stack vertical spacing="tight">
                                                    <Text as="h3" variant="bodyMd" fontWeight="bold">
                                                        {alt || (image?.url ? image.url.split("/").pop().split("?")[0] : "Unnamed file")}
                                                    </Text>
                                                    <Text variation="subdued">
                                                        {size ? (size / 1024).toFixed(1) : "?"} KB • {image?.width}×{image?.height}px
                                                    </Text>
                                                    <a href={image?.url} target="_blank" rel="noreferrer">
                                                        Xem ảnh
                                                    </a>
                                                </Stack>

                                                {/* Bên phải: nút Optimize */}
                                                <Button
                                                    primary
                                                    size="slim"
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
