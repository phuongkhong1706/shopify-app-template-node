// src/pages/LoginPage.jsx
import { useState } from "react";
import { Card, TextField, Button, Stack } from "@shopify/polaris";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    alert(`Login with username=${username}, password=${password}`);
    // Ở đây bạn có thể gọi API backend để login
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto" }}>
      <Card sectioned>
        <Stack vertical>
          <h2>Đăng nhập</h2>
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
          <Button primary onClick={handleLogin}>
            Login
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
