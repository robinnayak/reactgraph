const fs = require("node:fs");
const path = require("node:path");

const uiDist = path.resolve(__dirname, "../../ui/dist");
const coreViewerDist = path.resolve(__dirname, "../dist/viewer");

if (!fs.existsSync(uiDist)) {
  console.warn("ReactGraph core: UI dist not found, skipping viewer asset copy.");
  process.exit(0);
}

fs.mkdirSync(coreViewerDist, { recursive: true });
fs.cpSync(uiDist, coreViewerDist, { recursive: true, force: true });
console.log("ReactGraph core: copied viewer assets into dist/viewer");
