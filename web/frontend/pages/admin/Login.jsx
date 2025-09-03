// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { Card, TextField, Button, Stack, Banner } from "@shopify/polaris";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Nếu đã có token → redirect thẳng dashboard
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      window.location.href = "/admin/store";
    }
  }, []);

  const handleLogin = async () => {
    setError("");
    if (!username || !password) {
      setError("Vui lòng nhập username và password");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.message || "Login failed");
        setLoading(false);
        return;
      }

      const data = await response.json();
      const token = data.token;

      // Lưu token để dùng cho các API khác
      localStorage.setItem("authToken", token);

      // Redirect sang dashboard
      window.location.href = "/admin/store";
    } catch (err) {
      console.error(err);
      setError("Login error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto" }}>
      <Card sectioned>
        <Stack vertical spacing="loose">
          <h2>Đăng nhập</h2>
          {error && <Banner status="critical">{error}</Banner>}
          <TextField
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="off"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="off"
          />
          <Button primary loading={loading} onClick={handleLogin}>
            Login
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
