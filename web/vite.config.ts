import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
  build: {
    assetsInlineLimit: (filePath) => (filePath.includes("home-entry") ? false : undefined),
  },
  server: {
    port: 5173,
  },
});
