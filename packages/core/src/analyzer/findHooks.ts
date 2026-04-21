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
  resolveProjectFiles
} from "./shared.js";

export function findHooks(projectRoot: string): HookNode[] {
  const hooks: HookNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, TS_GLOBS)) {
    try {
      const module = parseModule(filePath);

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
          id: createNodeId("hook", relativeFilePath(projectRoot, filePath)),
          name,
          filePath: relativeFilePath(projectRoot, filePath),
          type: "hook",
          params: extractParams(fn.params, module.source),
          returns: extractReturns(fn, module.source)
        });
      };

      const handleVariableDeclaration = (statement: TSESTree.VariableDeclaration) => {
        for (const declaration of statement.declarations) {
          if (
            declaration.id.type === "Identifier" &&
            declaration.init &&
            (declaration.init.type === "ArrowFunctionExpression" ||
              declaration.init.type === "FunctionExpression")
          ) {
            const isExported =
              module.exports.has(declaration.id.name) || module.defaultExportName === declaration.id.name;
            if (isExported) {
              pushHook(declaration.id.name, declaration.init);
            }
          }
        }
      };

      for (const statement of (module.ast as TSESTree.Program).body) {
        if (statement.type === "FunctionDeclaration" && statement.id) {
          const isExported = module.exports.has(statement.id.name) || module.defaultExportName === statement.id.name;
          if (isExported) {
            pushHook(statement.id.name, statement);
          }
        }

        if (statement.type === "VariableDeclaration") {
          handleVariableDeclaration(statement);
        }

        if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
          if (statement.declaration.type === "FunctionDeclaration" && statement.declaration.id) {
            pushHook(statement.declaration.id.name, statement.declaration);
          }
          if (statement.declaration.type === "VariableDeclaration") {
            handleVariableDeclaration(statement.declaration);
          }
        }

      if (statement.type === "ExportDefaultDeclaration") {
        const declaration = statement.declaration;
        if (
          declaration.type === "ArrowFunctionExpression" ||
          declaration.type === "FunctionExpression"
        ) {
          pushHook(inferAnonymousExportName(filePath), declaration);
        } else if (declaration.type === "FunctionDeclaration") {
          pushHook(declaration.id?.name ?? inferAnonymousExportName(filePath), declaration);
        }
      }
      }
    } catch (err) {
      console.warn(`[ReactGraph] Skipping ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(hooks, (hook) => hook.id);
}
