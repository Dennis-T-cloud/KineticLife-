import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "mediapipe-sourcemap-fix",
      transform(code, id) {
        if (id.includes("@mediapipe/tasks-vision")) {
          return code.replace(/\/\/# sourceMappingURL=\S+/g, "");
        }
      },
    },
  ],
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
  },
  worker: {
    format: "es", // pose-inference.worker uses dynamic import('@mediapipe/tasks-vision')
  },
  build: {
    assetsInlineLimit: (filePath) => (filePath.includes("home-entry") ? false : undefined),
  },
  server: {
    port: 5173,
  },
});
