import fs from "node:fs/promises";
import path from "node:path";
import type { GraphData } from "../types.js";
import { buildEdges } from "./buildEdges.js";
import { resolveAnalyzerConfig, type AnalyzerConfigInput } from "./config.js";
import { findApis } from "./findApis.js";
import { findComponents } from "./findComponents.js";
import { findHooks } from "./findHooks.js";
import { detectProjectType, findPages } from "./findPages.js";

export interface AnalyzeOptions extends AnalyzerConfigInput {
  writeJson?: boolean;
}

export async function analyze(projectRoot: string, options: AnalyzeOptions = {}): Promise<GraphData> {
  const root = path.resolve(projectRoot);
  const projectType = detectProjectType(root);
  const config = resolveAnalyzerConfig(root, options);
  const pages = findPages(root, config);
  const components = findComponents(root, config);
  const hooks = findHooks(root);
  const apis = findApis(root);
  const edges = buildEdges(pages, components, hooks, apis, root);

  const graph: GraphData = { projectType, pages, components, hooks, apis, edges };
  if (options.writeJson !== false) {
    await fs.writeFile(path.join(root, "reactgraph.json"), JSON.stringify(graph, null, 2), "utf8");
  }
  return graph;
}

