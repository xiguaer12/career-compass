import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "^/admin/(auth|dashboard|contents|content|sources|community|paths|users|crawl|charts|tags|ai|reports|audits)(/|\\?|$)": "http://localhost:8080",
      "/templates": "http://localhost:8080"
    }
  }
});
