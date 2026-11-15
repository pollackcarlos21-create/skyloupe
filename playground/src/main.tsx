import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mountDevtools } from "@skyloupe/devtools";
import { App, acceptPlaygroundSend } from "./App";
import { installMockBridge } from "./mockBridge";
import "./styles.css";

installMockBridge((bundle) => acceptPlaygroundSend(bundle));
mountDevtools();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
