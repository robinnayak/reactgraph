import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { analyze, type GraphData } from "@reactgraph/core";

let currentPanel: vscode.WebviewPanel | undefined;

function getUiDistPath(context: vscode.ExtensionContext): string {
  return path.join(context.extensionPath, "..", "ui", "dist");
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

async function buildHtml(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  graphData: GraphData
): Promise<string> {
  const uiDist = getUiDistPath(context);
  const indexPath = path.join(uiDist, "index.html");
  let html = await fs.readFile(indexPath, "utf8");

  html = html.replace(
    /(src|href)="(\/assets\/[^"]+)"/g,
    (match: string, attribute: string, assetPath: string) => {
      const assetUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(uiDist, assetPath)));
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
  const graphData = await analyze(workspaceRoot);
  panel.webview.html = await buildHtml(context, panel, graphData);
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand("reactgraph.openGraph", async () => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      void vscode.window.showErrorMessage("ReactGraph needs an open workspace folder.");
      return;
    }

    const workspaceRoot = workspaceFolder.uri.fsPath;
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
  });

  const saveWatcher = vscode.workspace.onDidSaveTextDocument(async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot || !currentPanel) {
      return;
    }
    await renderPanel(context, currentPanel, workspaceRoot);
  });

  context.subscriptions.push(disposable, saveWatcher);
}

export function deactivate(): void {
  currentPanel = undefined;
}
