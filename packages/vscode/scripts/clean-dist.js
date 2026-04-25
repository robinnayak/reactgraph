const fs = require("node:fs");
const path = require("node:path");

const dist = path.resolve(__dirname, "../dist");

if (fs.existsSync(dist)) {
  try {
    fs.rmSync(dist, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      console.warn(`ReactGraph VS Code: could not fully clear ${dist}; continuing with existing dist contents.`);
    } else {
      throw error;
    }
  }
}
