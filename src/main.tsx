import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./creator/design-tokens.css";
import "./install/install-guide.css";
import "./creator/surface.css";
import "./creator/creator-shell.css";
import "./creator/creator-home.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
