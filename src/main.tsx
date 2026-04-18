import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Catalogo from "./pages/Catalogo";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Catalogo />
  </StrictMode>
);
