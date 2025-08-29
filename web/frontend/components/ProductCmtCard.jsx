// ProductCmtCard.jsx
import { useState, useEffect } from "react";
import {
    Card,
    TextField,
    Button,
    Select,
    Stack
} from "@shopify/polaris";

export function ProductCmtCard() {
    const [comment, setComment] = useState("");
    const [productId, setProductId] = useState(""); // Lưu ID sản phẩm được chọn
    const [products, setProducts] = useState([]); // Lưu danh sách sản phẩm thô từ API
    const [selectedProductValue, setSelectedProductValue] = useState(""); // Giá trị của Select Polaris

    // Lấy danh sách sản phẩm từ backend
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                // Kiểm tra lại URL API có đúng không, nếu backend của bạn chạy trên một port khác
                // thì có thể cần cấu hình proxy trong vite.config.js hoặc sử dụng full URL.
                // Với cấu hình hiện tại, '/api/products/list' là đúng nếu proxy được thiết lập.
                const res = await fetch("/api/products/list");
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const data = await res.json();
                console.log("Products API data:", data);

                if (Array.isArray(data)) {
                    setProducts(data); // Lưu dữ liệu thô
                    if (data.length > 0) {
                        // Chọn sản phẩm đầu tiên làm mặc định nếu có
                        setSelectedProductValue(data[0].id.toString());
                        setProductId(data[0].id.toString());
                    }
                } else {
                    console.error("API response is not an array:", data);
                }

            } catch (err) {
                console.error("Error fetching products:", err);
                alert(`Error fetching products: ${err.message}`);
            }
        };
        fetchProducts();
    }, []);

    // Xử lý khi chọn sản phẩm từ Select
    const handleProductSelectChange = (value) => {
        setSelectedProductValue(value); // Cập nhật giá trị của Select
        setProductId(value); // Cập nhật productId để gửi lên backend
    };

    // Lưu comment
    const handleSave = async () => {
        if (!productId) {
            alert("Please select a product first.");
            return;
        }
        if (!comment.trim()) {
            alert("Comment cannot be empty.");
            return;
        }

        try {
            const res = await fetch("/api/save-comment-product", { // ✅ Đảm bảo URL này khớp với router trong index.js
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId, comment }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            alert(data.message || "Comment saved successfully!");
            setComment(""); // Xóa comment sau khi lưu
        } catch (error) {
            console.error("Error saving comment:", error);
            alert(`Failed to save comment: ${error.message}`);
        }
    };

    // Chuẩn bị options cho Select component
    const productOptions = products.map((p) => ({
        label: p.title,
        value: p.id.toString(), // Đảm bảo value là string
    }));

    return (
        <Card sectioned>
            <Stack vertical>
                <h2>Save Comment to Product</h2>
                <Select
                    label="Select a product"
                    options={productOptions} // ✅ Sử dụng options đã được định dạng
                    value={selectedProductValue} // ✅ Sử dụng state riêng cho value của Select
                    onChange={handleProductSelectChange} // ✅ Xử lý onChange riêng
                    placeholder="Select a product" // Thêm placeholder
                />
                <TextField
                    label="Product ID (selected)"
                    value={productId} // Hiển thị productId đã chọn
                    disabled
                    autoComplete="off"
                />
                <TextField
                    label="Comment"
                    value={comment}
                    onChange={(newValue) => setComment(newValue)}
                    multiline={4}
                    autoComplete="off"
                    placeholder="Enter your comment here..."
                />
                <Button primary onClick={handleSave} loading={false}> {/* Thêm loading state nếu cần */}
                    Save Comment
                </Button>
            </Stack>
        </Card>
    );
}