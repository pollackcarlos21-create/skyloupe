import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.SKYLOUPE_PAGES === "1" ? "/skyloupe/" : "/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5174 },
});
