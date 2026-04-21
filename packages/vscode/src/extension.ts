import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import type { GraphData } from "@reactgraph/core";

let currentPanel: vscode.WebviewPanel | undefined;

function loadAnalyze(): typeof import("@reactgraph/core").analyze {
  const { analyze } = require("@reactgraph/core") as typeof import("@reactgraph/core");
  return analyze;
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
  const graphData = await analyze(workspaceRoot);
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
