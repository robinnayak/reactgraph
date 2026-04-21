import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GraphData } from "./types.js";
import { analyze } from "./analyzer/analyze.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const viewerDistDir = path.join(__dirname, "viewer");

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function getContentType(filePath: string): string {
  return mimeTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function ensureViewerAssets(): void {
  if (!fs.existsSync(viewerDistDir)) {
    throw new Error(
      "Viewer assets were not found in @reactgraph/core. Rebuild or reinstall the package so dist/viewer is included."
    );
  }
}

function serveFile(response: http.ServerResponse, filePath: string): void {
  const file = fs.readFileSync(filePath);
  response.writeHead(200, { "Content-Type": getContentType(filePath) });
  response.end(file);
}

function openBrowser(url: string): void {
  const platform = process.platform;

  if (platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  if (platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }

  spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
}

export interface ViewerResult {
  graphData: GraphData;
  server: http.Server;
  url: string;
}

export async function startViewer(targetProject: string, port = 4174): Promise<ViewerResult> {
  ensureViewerAssets();
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
    const filePath = path.resolve(viewerDistDir, relativePath);
    const isInsideViewerDist = filePath.startsWith(viewerDistDir);

    if (isInsideViewerDist && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveFile(response, filePath);
      return;
    }

    serveFile(response, path.join(viewerDistDir, "index.html"));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });

  return {
    graphData,
    server,
    url: `http://127.0.0.1:${port}`
  };
}

export function launchViewer(url: string): void {
  openBrowser(url);
}
