import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "shiki-core": ["shiki/core"],
          "react-flow": ["reactflow"],
          "react-vendor": ["react", "react-dom"],
          "ui-icons": ["lucide-react"]
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
});
