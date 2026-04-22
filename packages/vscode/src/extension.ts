import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import * as vscode from "vscode";
import type { GraphData } from "@reactgraph-ui/core";

interface HealthIssue {
  filePath: string;
  absolutePath?: string;
  severity: "error" | "warning";
  code?: number;
  message: string;
  source?: string;
}

interface HealthCheckResults {
  issues: HealthIssue[];
  errorCount: number;
  warningCount: number;
  fileCount: number;
  clean: boolean;
  cancelled?: boolean;
  generatedAt: string;
}

let currentPanel: vscode.WebviewPanel | undefined;
let healthCheckProcess: ChildProcess | undefined;
let lastHealthCheckResults: HealthCheckResults | null = null;
let currentWorkspaceRoot: string | undefined;
const output = vscode.window.createOutputChannel("ReactGraph");
const initializedPanels = new WeakSet<vscode.WebviewPanel>();

function loadAnalyze(): typeof import("@reactgraph-ui/core").analyze {
  const { analyze } = require("@reactgraph-ui/core") as typeof import("@reactgraph-ui/core");
  return analyze;
}

function isGraphData(value: unknown): value is GraphData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["pages", "components", "hooks", "apis", "edges"].every((key) => Array.isArray(candidate[key]));
}

function hasGraphContent(graphData: GraphData): boolean {
  return (
    graphData.pages.length > 0 ||
    graphData.components.length > 0 ||
    graphData.hooks.length > 0 ||
    graphData.apis.length > 0 ||
    graphData.edges.length > 0
  );
}

function summarizeGraph(graphData: GraphData): string {
  return `${graphData.pages.length} pages, ${graphData.components.length} components, ${graphData.hooks.length} hooks, ${graphData.apis.length} apis, ${graphData.edges.length} edges`;
}

function readExistingGraphData(workspaceRoot: string): GraphData | null {
  const jsonPath = path.join(workspaceRoot, "reactgraph.json");
  if (!fs.existsSync(jsonPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8")) as unknown;
    return isGraphData(parsed) ? parsed : null;
  } catch (error) {
    output.appendLine(`Failed to read existing reactgraph.json: ${(error as Error).message}`);
    return null;
  }
}

function injectGraphData(
  html: string,
  graphData: GraphData,
  healthResults: HealthCheckResults | null,
  nonce: string
): string {
  const bridge = `
    <script nonce="${nonce}">
      window.vscodeApi = acquireVsCodeApi();
      window.__REACTGRAPH_DATA__ = ${JSON.stringify(graphData)};
      window.__REACTGRAPH_HEALTH__ = ${JSON.stringify(healthResults)};
    </script>
  `;
  return html.replace("</head>", `${bridge}</head>`);
}

function getWebviewDistUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, "dist", "webview");
}

function postPanelMessage(message: unknown): void {
  void currentPanel?.webview.postMessage(message);
}

function stopHealthCheck(panel?: vscode.WebviewPanel): void {
  if (!healthCheckProcess) {
    return;
  }

  healthCheckProcess.kill();
  healthCheckProcess = undefined;
  void panel?.webview.postMessage({ type: "healthCheckCancelled" });
}

function startHealthCheck(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, workspaceRoot: string): void {
  if (healthCheckProcess) {
    healthCheckProcess.kill();
    healthCheckProcess = undefined;
  }

  const workerPath = path.join(context.extensionPath, "dist", "healthCheckWorker.js");
  lastHealthCheckResults = null;
  output.appendLine(`Running health check in ${workspaceRoot}`);
  postPanelMessage({ type: "healthCheckStarted" });

  const child = fork(workerPath, [workspaceRoot], {
    silent: true,
    execArgv: []
  });
  healthCheckProcess = child;

  child.on("message", (message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if ((message as { type?: string }).type === "healthCheckResult") {
      const results = (message as { results: HealthCheckResults }).results;
      lastHealthCheckResults = results;
      output.appendLine(
        `Health check finished: ${results.errorCount} errors, ${results.warningCount} warnings across ${results.fileCount} files`
      );
      postPanelMessage({ type: "healthCheckResult", results });
      return;
    }

    if ((message as { type?: string }).type === "healthCheckError") {
      const errorMessage = (message as { error?: string }).error ?? "Unknown health check failure";
      output.appendLine(`Health check failed: ${errorMessage}`);
      postPanelMessage({ type: "healthCheckError", error: errorMessage });
    }
  });

  child.on("exit", (_code, signal) => {
    if (healthCheckProcess?.pid !== child.pid) {
      return;
    }

    healthCheckProcess = undefined;
    if (signal && signal !== "SIGTERM" && signal !== "SIGINT") {
      postPanelMessage({ type: "healthCheckError", error: `Health check exited unexpectedly (${signal}).` });
    }
  });

  child.on("error", (error) => {
    if (healthCheckProcess?.pid === child.pid) {
      healthCheckProcess = undefined;
    }
    output.appendLine(`Unable to start health check: ${error.message}`);
    postPanelMessage({ type: "healthCheckError", error: error.message });
  });
}

async function buildHtml(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  graphData: GraphData
): Promise<string> {
  const webviewDistUri = getWebviewDistUri(context);
  const htmlPath = vscode.Uri.joinPath(webviewDistUri, "index.html");
  const nonce = randomUUID().replace(/-/g, "");
  let html = fs.readFileSync(htmlPath.fsPath, "utf8");

  html = html.replace(
    /(src|href)="(\/assets\/[^"]+)"/g,
    (_match: string, attribute: string, assetPath: string) => {
      const assetUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistUri, assetPath));
      return `${attribute}="${assetUri}"`;
    }
  );

  html = html.replace(/<script\b/g, `<script nonce="${nonce}"`);

  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${panel.webview.cspSource} vscode-resource:; style-src 'unsafe-inline' ${panel.webview.cspSource} vscode-resource:; img-src ${panel.webview.cspSource} vscode-resource: data:;">`;
  html = html.replace("</head>", `${csp}</head>`);

  return injectGraphData(html, graphData, lastHealthCheckResults, nonce);
}

function attachPanelListeners(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): void {
  if (initializedPanels.has(panel)) {
    return;
  }

  panel.onDidDispose(() => {
    stopHealthCheck();
    currentPanel = undefined;
    currentWorkspaceRoot = undefined;
  });

  panel.webview.onDidReceiveMessage(async (message) => {
    const workspaceRoot = currentWorkspaceRoot;
    if (!workspaceRoot) {
      return;
    }

    if (message?.type === "openFile" && typeof message.filePath === "string") {
      const fullPath = path.isAbsolute(message.filePath)
        ? message.filePath
        : path.join(workspaceRoot, message.filePath);
      const doc = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(doc);
      return;
    }

    if (message?.type === "startHealthCheck") {
      startHealthCheck(context, panel, workspaceRoot);
      return;
    }

    if (message?.type === "cancelHealthCheck") {
      stopHealthCheck(panel);
      return;
    }

    if (message?.type === "clearHealthCheck") {
      lastHealthCheckResults = null;
    }
  });

  initializedPanels.add(panel);
}

async function renderPanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  workspaceRoot: string
): Promise<void> {
  const analyze = loadAnalyze();
  const existingGraphData = readExistingGraphData(workspaceRoot);
  output.appendLine(`Analyzing workspace: ${workspaceRoot}`);

  let graphData = await analyze(workspaceRoot, { writeJson: false });
  output.appendLine(`Extension analysis result: ${summarizeGraph(graphData)}`);

  if (!hasGraphContent(graphData) && existingGraphData && hasGraphContent(existingGraphData)) {
    output.appendLine("Extension analysis returned an empty graph. Falling back to existing reactgraph.json.");
    graphData = existingGraphData;
  }

  panel.webview.html = await buildHtml(context, panel, graphData);
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("reactgraph.openGraph", async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (!workspaceRoot) {
      void vscode.window.showErrorMessage("ReactGraph: No workspace folder open.");
      return;
    }

    try {
      currentWorkspaceRoot = workspaceRoot;
      currentPanel =
        currentPanel ??
        vscode.window.createWebviewPanel("reactgraph", "ReactGraph", vscode.ViewColumn.Beside, {
          enableScripts: true,
          retainContextWhenHidden: true
        });

      attachPanelListeners(context, currentPanel);

      await renderPanel(context, currentPanel, workspaceRoot);
      currentPanel.reveal(vscode.ViewColumn.Beside);
    } catch (err) {
      void vscode.window.showErrorMessage(`ReactGraph: Analysis failed - ${(err as Error).message}`);
    }
  });

  const saveWatcher = vscode.workspace.onDidSaveTextDocument(async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !currentPanel) {
      return;
    }

    try {
      await renderPanel(context, currentPanel, workspaceRoot);
    } catch (err) {
      void vscode.window.showErrorMessage(`ReactGraph: Analysis failed - ${(err as Error).message}`);
    }
  });

  context.subscriptions.push(disposable, saveWatcher, output);
}

export function deactivate(): void {
  stopHealthCheck();
  currentPanel = undefined;
  currentWorkspaceRoot = undefined;
}
