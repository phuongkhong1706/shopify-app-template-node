import { Button } from "@shopify/polaris";

export default function LoginButton() {
  const handleLogin = () => {
    // redirect toàn màn hình
    window.top.location.href = "https://phuongkhong.myshopify.com/login";
  };

  return <Button onClick={handleLogin}>Login</Button>;
}
