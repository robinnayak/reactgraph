const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve(__dirname, "../../ui/dist");
const dest = path.resolve(__dirname, "../dist/webview");

if (!fs.existsSync(src)) {
  console.error("UI dist not found. Run npm run build in packages/ui first.");
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true, force: true });
console.log("UI dist copied to dist/webview");
