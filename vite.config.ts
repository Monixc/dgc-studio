import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tajarace/core": path.resolve(__dirname, "./src/vendor/tajarace/core/index.ts"),
      "@tajarace/content": path.resolve(__dirname, "./src/vendor/tajarace/content/index.ts"),
      "@tajarace/storage": path.resolve(__dirname, "./src/vendor/tajarace/storage/index.ts"),
      "@tajarace/racing": path.resolve(__dirname, "./src/vendor/tajarace/racing/index.ts"),
      "@tajarace/ui": path.resolve(__dirname, "./src/vendor/tajarace/ui/index.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
