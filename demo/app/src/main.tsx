import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mountDevtools } from "@skyloupe/devtools";
import { App } from "./App";
import "./styles.css";

mountDevtools();

const root = document.getElementById("root");
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);
