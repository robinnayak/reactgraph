const fs = require("node:fs");
const path = require("node:path");

const uiDist = path.resolve(__dirname, "../../ui/dist");
const coreViewerDist = path.resolve(__dirname, "../dist/viewer");

function removePathIfPresent(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      console.warn(`ReactGraph core: could not fully clear ${targetPath}; overwriting existing viewer assets instead.`);
      return;
    }
    throw error;
  }
}

if (!fs.existsSync(uiDist)) {
  console.warn("ReactGraph core: UI dist not found, skipping viewer asset copy.");
  process.exit(0);
}

removePathIfPresent(coreViewerDist);
fs.mkdirSync(coreViewerDist, { recursive: true });
fs.cpSync(uiDist, coreViewerDist, { recursive: true, force: true });
const copiedJson = path.join(coreViewerDist, "reactgraph.json");
removePathIfPresent(copiedJson);
console.log("ReactGraph core: copied viewer assets into dist/viewer");
