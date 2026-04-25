import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

if (process.platform === "win32") {
  process.env.ESBUILD_BINARY_PATH = path.resolve(currentDir, "../../../scripts/esbuild.cmd");
}

try {
  await build({
    configFile: false,
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
} catch (error) {
  const distIndex = path.resolve(currentDir, "../dist/index.html");
  const canReuseExistingDist =
    process.platform === "win32" &&
    fs.existsSync(distIndex) &&
    error &&
    typeof error === "object" &&
    "pluginCode" in error &&
    (error.pluginCode === "EPERM" || error.pluginCode === "EINVAL");

  if (canReuseExistingDist) {
    console.warn("ReactGraph webview: reusing existing dist because esbuild could not be spawned in this Windows environment.");
  } else {
    throw error;
  }
}
