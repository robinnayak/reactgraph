const fs = require("node:fs");
const path = require("node:path");

const dist = path.resolve(__dirname, "../dist");

fs.rmSync(dist, { recursive: true, force: true });
