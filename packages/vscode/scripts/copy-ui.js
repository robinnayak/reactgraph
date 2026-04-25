const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve(__dirname, "../../ui/dist");
const dest = path.resolve(__dirname, "../dist/webview");

function removePathIfPresent(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      console.warn(`ReactGraph VS Code: could not fully clear ${targetPath}; overwriting existing UI assets instead.`);
      return;
    }
    throw error;
  }
}

if (!fs.existsSync(src)) {
  console.error("UI dist not found. Run npm run build in packages/ui first.");
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true, force: true });
const copiedJson = path.join(dest, "reactgraph.json");
if (fs.existsSync(copiedJson)) {
  removePathIfPresent(copiedJson);
  console.log("Removed stale reactgraph.json from webview dist");
}
console.log("UI dist copied to dist/webview");
