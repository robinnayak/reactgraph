const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const packageJson = require("../package.json");
const outputDir = path.resolve(__dirname, "..");
const outputFile = path.join(outputDir, `reactgraph-vscode-${packageJson.version}.vsix`);
const vsceCli = path.resolve(__dirname, "../../../node_modules/@vscode/vsce/vsce");

fs.mkdirSync(outputDir, { recursive: true });

const result = spawnSync(process.execPath, [vsceCli, "package", "--no-dependencies", "--out", outputFile], {
  cwd: path.resolve(__dirname, ".."),
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
