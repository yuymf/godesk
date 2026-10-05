import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./creator/design-tokens.css";
import "./install/install-guide.css";
import "./creator/surface.css";
import "./creator/creator-shell.css";
import "./creator/creator-home.css";

// G3D-05 TEMP over-budget proof: 300 ms synchronous main-thread block (reverted before merge).
const overBudgetUntil = performance.now() + 300;
while (performance.now() < overBudgetUntil) {
  // busy wait
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
