#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { analyze } from "./analyzer/analyze.js";
import { launchViewer, startViewer } from "./viewer.js";

function printSummary(projectPath: string, graph: Awaited<ReturnType<typeof analyze>>): void {
  console.log(
    `Analyzed ${path.resolve(projectPath)} -> ${graph.pages.length} pages, ${graph.components.length} components, ${graph.hooks.length} hooks, ${graph.apis.length} apis, ${graph.edges.length} edges`
  );
}

const program = new Command();
program
  .name("reactgraph")
  .description("ReactGraph CLI - analyze your React/Next.js project structure");

program
  .command("analyze [path]")
  .argument("[path]", "Project path", ".")
  .action(async (projectPath) => {
    const graph = await analyze(projectPath);
    printSummary(projectPath, graph);
  });

program
  .command("serve [path]")
  .argument("[path]", "Project path", ".")
  .option("-p, --port <port>", "Port to serve the graph UI on", "4174")
  .action(async (projectPath, options) => {
    const port = Number.parseInt(String(options.port), 10);
    const { graphData, url } = await startViewer(projectPath, Number.isNaN(port) ? 4174 : port);
    printSummary(projectPath, graphData);
    console.log(`ReactGraph viewer running at ${url}`);
    console.log("Press Ctrl+C to stop the local viewer.");
  });

program
  .command("view [path]")
  .argument("[path]", "Project path", ".")
  .option("-p, --port <port>", "Port to serve the graph UI on", "4174")
  .action(async (projectPath, options) => {
    const port = Number.parseInt(String(options.port), 10);
    const { graphData, url } = await startViewer(projectPath, Number.isNaN(port) ? 4174 : port);
    printSummary(projectPath, graphData);
    launchViewer(url);
    console.log(`Opened ReactGraph viewer at ${url}`);
    console.log("Press Ctrl+C to stop the local viewer.");
  });

await program.parseAsync(process.argv);
