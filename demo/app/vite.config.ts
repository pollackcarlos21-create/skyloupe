import react from "@vitejs/plugin-react";
import skyloupe from "@skyloupe/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), skyloupe()],
  server: { host: "127.0.0.1", port: 5173 },
});
