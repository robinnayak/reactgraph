import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import type { GraphData } from "@reactgraph/core";

let currentPanel: vscode.WebviewPanel | undefined;
const output = vscode.window.createOutputChannel("ReactGraph");

function loadAnalyze(): typeof import("@reactgraph/core").analyze {
  const { analyze } = require("@reactgraph/core") as typeof import("@reactgraph/core");
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

function injectGraphData(html: string, graphData: GraphData): string {
  const bridge = `
    <script>
      const vscode = acquireVsCodeApi();
      window.__REACTGRAPH_DATA__ = ${JSON.stringify(graphData)};
      window.addEventListener("message", (event) => {
        if (event.data?.type === "openFile" && event.data.filePath) {
          vscode.postMessage(event.data);
        }
      });
    </script>
  `;
  return html.replace("</head>", `${bridge}</head>`);
}

function getWebviewDistUri(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.extensionUri, "dist", "webview");
}

async function buildHtml(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  graphData: GraphData
): Promise<string> {
  const webviewDistUri = getWebviewDistUri(context);
  const htmlPath = vscode.Uri.joinPath(webviewDistUri, "index.html");
  let html = fs.readFileSync(htmlPath.fsPath, "utf8");

  html = html.replace(
    /(src|href)="(\/assets\/[^"]+)"/g,
    (_match: string, attribute: string, assetPath: string) => {
      const assetUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistUri, assetPath));
      return `${attribute}="${assetUri}"`;
    }
  );

  return injectGraphData(html, graphData);
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
      currentPanel =
        currentPanel ??
        vscode.window.createWebviewPanel("reactgraph", "ReactGraph", vscode.ViewColumn.Beside, {
          enableScripts: true,
          retainContextWhenHidden: true
        });

      currentPanel.onDidDispose(() => {
        currentPanel = undefined;
      });

      currentPanel.webview.onDidReceiveMessage(async (message) => {
        if (message?.type === "openFile" && typeof message.filePath === "string") {
          const fullPath = path.isAbsolute(message.filePath)
            ? message.filePath
            : path.join(workspaceRoot, message.filePath);
          const doc = await vscode.workspace.openTextDocument(fullPath);
          await vscode.window.showTextDocument(doc);
        }
      });

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

  context.subscriptions.push(disposable, saveWatcher);
}

export function deactivate(): void {
  currentPanel = undefined;
}
