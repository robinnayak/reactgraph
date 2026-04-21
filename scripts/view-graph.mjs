import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyze } from "../packages/core/dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const uiDistDir = path.join(repoRoot, "packages", "ui", "dist");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function getContentType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function printUsage() {
  console.log("Usage: npm run view -- <path-to-react-project>");
  console.log("Example: npm run view -- C:\\Users\\robin\\OneDrive\\Desktop\\ecommerse");
}

function ensureBuildArtifacts() {
  if (!fs.existsSync(uiDistDir)) {
    throw new Error("UI build not found. Run `npm run build -- --force` from the repo root first.");
  }
}

function resolveTargetProject(argument) {
  if (!argument) {
    return process.cwd();
  }

  return path.resolve(argument);
}

function serveFile(response, filePath) {
  const file = fs.readFileSync(filePath);
  response.writeHead(200, { "Content-Type": getContentType(filePath) });
  response.end(file);
}

export async function startViewer(targetProject, port = 4174) {
  ensureBuildArtifacts();
  const graphData = await analyze(targetProject);
  const graphJson = JSON.stringify(graphData, null, 2);

  const server = http.createServer((request, response) => {
    const urlPath = request.url?.split("?")[0] ?? "/";

    if (urlPath === "/reactgraph.json") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(graphJson);
      return;
    }

    const relativePath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
    const filePath = path.resolve(uiDistDir, relativePath);
    const isInsideUiDist = filePath.startsWith(uiDistDir);

    if (isInsideUiDist && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(response, filePath);
      return;
    }

    serveFile(response, path.join(uiDistDir, "index.html"));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    server,
    url: `http://127.0.0.1:${port}`,
    graphData
  };
}

async function main() {
  const arg = process.argv[2];
  if (arg === "--help" || arg === "-h") {
    printUsage();
    return;
  }

  const targetProject = resolveTargetProject(arg);
  const { url, graphData } = await startViewer(targetProject);

  console.log(`ReactGraph viewer running at ${url}`);
  console.log(`Project: ${targetProject}`);
  console.log(
    `Graph: ${graphData.pages.length} pages, ${graphData.components.length} components, ${graphData.hooks.length} hooks, ${graphData.apis.length} apis, ${graphData.edges.length} edges`
  );
  console.log("Press Ctrl+C to stop the local viewer.");
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(`ReactGraph viewer failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
