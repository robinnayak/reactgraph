import fs from "node:fs/promises";
import path from "node:path";
import type { GraphData } from "../types.js";
import { buildEdges } from "./buildEdges.js";
import { findApis } from "./findApis.js";
import { findComponents } from "./findComponents.js";
import { findHooks } from "./findHooks.js";
import { findPages } from "./findPages.js";

export async function analyze(projectRoot: string): Promise<GraphData> {
  const root = path.resolve(projectRoot);
  const pages = findPages(root);
  const components = findComponents(root);
  const hooks = findHooks(root);
  const apis = findApis(root);
  const edges = buildEdges(pages, components, hooks, apis, root);

  const graph: GraphData = { pages, components, hooks, apis, edges };
  await fs.writeFile(path.join(root, "reactgraph.json"), JSON.stringify(graph, null, 2), "utf8");
  return graph;
}
