import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./creator/creator.css";
import "./install/install-guide.css";
import "./creator/surface.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
