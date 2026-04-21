import path from "node:path";
import { Command } from "commander";
import { analyze } from "./analyzer/analyze.js";

const program = new Command();
program
  .name("reactgraph")
  .description("ReactGraph CLI — analyze your React/Next.js project structure");

program
  .command("analyze [path]")
  .argument("[path]", "Project path", ".")
  .action(async (projectPath) => {
    const graph = await analyze(projectPath);
    console.log(
      `Analyzed ${path.resolve(projectPath)} -> ${graph.pages.length} pages, ${graph.components.length} components, ${graph.hooks.length} hooks, ${graph.apis.length} apis, ${graph.edges.length} edges`
    );
  });

program.parseAsync(process.argv);
