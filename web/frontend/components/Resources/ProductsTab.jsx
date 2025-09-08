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
    Stack,
    Toast,
    Frame
} from "@shopify/polaris";

export default function ProductsTab() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    // state cho edit
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [title, setTitle] = useState("");
    const [desc, setDesc] = useState("");
    const [suggested, setSuggested] = useState("");
    const [titleSuggestion, setTitleSuggestion] = useState("");
    const [descSuggestion, setDescSuggestion] = useState("");

    // Toast state
    const [toastContent, setToastContent] = useState("");
    const [toastError, setToastError] = useState(false);
    const [showToast, setShowToast] = useState(false);

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

    // --- bỏ hẳn call suggest ở handleEdit ---
    const handleEdit = (product) => {
        setSelectedProduct(product);
        setTitle(product.title || "");
        setDesc(
            product.descriptionHtml
                ? product.descriptionHtml.replace(/<[^>]+>/g, "")
                : ""
        );
        setTitleSuggestion("");
        setDescSuggestion("");
    };

    const handleClose = () => {
        setSelectedProduct(null);
        setTitle("");
        setDesc("");
        setSuggested("");
    };

    // Hàm Save
    const handleSave = async () => {
        try {
            const resp = await fetch(`/api/admin/resources/products`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: selectedProduct.id,   // nguyên gid://shopify/Product/...
                    title,
                    descriptionHtml: desc,
                }),
            });

            const data = await resp.json();

            if (data.userErrors?.length) {
                console.error("❌ Update failed:", data.userErrors);
                setToastContent(data.userErrors[0].message);
                setToastError(true);
                setShowToast(true);
            } else {
                console.log("✅ Update success:", data.product);
                setToastContent("Product updated successfully");
                setToastError(false);
                setShowToast(true);

                setProducts((prev) =>
                    prev.map((p) =>
                        p.id === selectedProduct.id
                            ? { ...p, title, descriptionHtml: desc }
                            : p
                    )
                );
                handleClose();
            }
        } catch (err) {
            console.error("❌ Save error:", err);
            setToastContent("❌ Network error");
            setToastError(true);
            setShowToast(true);
        }
    };

    // --- gọi AI suggest qua button thôi ---
    const handleSuggest = async () => {
        try {
            const resp = await fetch("/api/admin/resources/suggest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description: desc,
                }),
            });
            const data = await resp.json();

            if (data.title || data.description) {
                setTitleSuggestion(data.title || "");
                setDescSuggestion(data.description || "");
            } else {
                setToastContent("No suggestion received");
                setToastError(true);
                setShowToast(true);
            }
        } catch (err) {
            console.error("❌ Suggest error:", err);
            setToastContent("Failed to fetch suggestion");
            setToastError(true);
            setShowToast(true);
        }
    };

    // --- apply suggestion ---
    const applySuggestion = () => {
        if (titleSuggestion) setTitle(titleSuggestion);
        if (descSuggestion) setDesc(descSuggestion);
        setToastContent("✅ Applied AI suggestions");
        setToastError(false);
        setShowToast(true);
    };

    if (loading) return <Spinner accessibilityLabel="Loading products" />;

    return (
        <Frame>
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
                                handleSave();
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
                                <Stack spacing="tight">
                                    <Button onClick={handleSuggest}>AI Suggest</Button>
                                    {(titleSuggestion || descSuggestion) && (
                                        <Button onClick={applySuggestion}>Apply Suggestion</Button>
                                    )}
                                </Stack>
                                {titleSuggestion && (
                                    <TextField
                                        label="AI Suggested Title"
                                        value={titleSuggestion}
                                        multiline
                                        disabled
                                    />
                                )}
                                {descSuggestion && (
                                    <TextField
                                        label="AI Suggested Description"
                                        value={descSuggestion}
                                        multiline={4}
                                        disabled
                                    />
                                )}
                            </FormLayout>
                        </Modal.Section>
                    </Modal>
                )}
            </Box>
            {showToast && (
                <Toast
                    content={toastContent}
                    error={toastError}
                    onDismiss={() => setShowToast(false)}
                />
            )}
        </Frame>
    );
}
