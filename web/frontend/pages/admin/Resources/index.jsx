import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function ResourcesIndex() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === "/admin/resources") {
      navigate("/admin/resources/products", { replace: true });
    }
  }, [location, navigate]);

  return null; // không render gì, chỉ redirect
}
