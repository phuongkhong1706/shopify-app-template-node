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
    Stack
} from "@shopify/polaris";

export default function ProductsTab() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // state cho edit
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [suggested, setSuggested] = useState("");

    useEffect(() => {
        fetch("/api/admin/resources/products")
            .then((res) => res.json())
            .then((data) => setProducts(data.products || []))
            .catch((err) => {
                console.error("❌ Failed to load products:", err);
                setProducts([]);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleEdit = (product) => {
        setSelectedProduct(product);
        setTitle(product.title || "");
        setDesc(
            product.descriptionHtml
                ? product.descriptionHtml.replace(/<[^>]+>/g, "")
                : ""
        );
        // gọi API lấy suggested content từ AI
        fetch(`/api/admin/resources/suggest?productId=${product.id}`)
            .then((res) => res.json())
            .then((data) => setSuggested(data.suggested || ""))
            .catch(() => setSuggested("No suggestion"));
    };

    const handleClose = () => {
        setSelectedProduct(null);
        setTitle("");
        setDesc("");
        setSuggested("");
    };

    if (loading) return <Spinner accessibilityLabel="Loading products" />;

    return (
        <Box padding="400" display="grid" gap="300">
            {products.map((p) => (
                <Card key={p.id} sectioned>
                    <Stack alignment="center" distribution="equalSpacing">
                        <Stack.Item fill>
                            <Box>
                                <Text variant="headingMd" as="h3">{p.title}</Text>
                                <Text tone="subdued">
                                    {p.descriptionHtml
                                        ? p.descriptionHtml.replace(/<[^>]+>/g, "").slice(0, 80) + "..."
                                        : "No description"}
                                </Text>
                            </Box>
                        </Stack.Item>

                        <Button primary onClick={() => handleEdit(p)}>
                            Edit
                        </Button>
                    </Stack>
                </Card>
            ))}

            {selectedProduct && (
                <Modal
                    open={!!selectedProduct}
                    onClose={handleClose}
                    title={`Edit ${selectedProduct.title}`}
                    primaryAction={{
                        content: "Save",
                        onAction: () => {
                            console.log("✅ Save data", { title, desc });
                            handleClose();
                        },
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
                                label="Description"
                                value={desc}
                                onChange={setDesc}
                                multiline={4}
                            />
                            <TextField
                                label="Suggested by AI"
                                value={suggested}
                                multiline={4}
                                disabled
                            />
                        </FormLayout>
                    </Modal.Section>
                </Modal>
            )}
        </Box>
    );
}
