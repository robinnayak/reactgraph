import type { TSESTree } from "@typescript-eslint/types";
import type { HookNode } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
  extractParams,
  extractReturns,
  inferAnonymousExportName,
  isHookName,
  parseModule,
  relativeFilePath,
  resolveProjectFiles,
  traverse
} from "./shared.js";

export function findHooks(projectRoot: string): HookNode[] {
  const hooks: HookNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, TS_GLOBS)) {
    try {
      const module = parseModule(filePath);
      const relativePath = relativeFilePath(projectRoot, filePath);

      const pushHook = (
        name: string,
        fn:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
      ) => {
        if (!isHookName(name)) {
          return;
        }

        hooks.push({
          id: createNodeId("hook", `${relativePath}:${name}`),
          name,
          filePath: relativePath,
          type: "hook",
          params: extractParams(fn.params, module.source),
          returns: extractReturns(fn, module.source)
        });
      };

      traverse(module.ast, (node, parent) => {
        if (node.type === "FunctionDeclaration" && node.id) {
          pushHook(node.id.name, node);
          return;
        }

        if (
          node.type === "VariableDeclarator" &&
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression")
        ) {
          pushHook(node.id.name, node.init);
          return;
        }

        if (
          node.type === "ExportDefaultDeclaration" &&
          (node.declaration.type === "ArrowFunctionExpression" ||
            node.declaration.type === "FunctionExpression" ||
            node.declaration.type === "FunctionDeclaration")
        ) {
          const name =
            "id" in node.declaration && node.declaration.id?.name
              ? node.declaration.id.name
              : inferAnonymousExportName(filePath);
          pushHook(name, node.declaration);
          return;
        }

        if (
          node.type === "PropertyDefinition" &&
          parent?.type === "ClassBody"
        ) {
          return;
        }
      });
    } catch (err) {
      console.warn(`[ReactGraph] Skipping ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(hooks, (hook) => `${hook.filePath}:${hook.name}`);
}
