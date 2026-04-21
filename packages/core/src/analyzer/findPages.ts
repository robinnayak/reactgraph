import path from "node:path";
import type { TSESTree } from "@typescript-eslint/types";
import type { PageNode } from "../types.js";
import {
  PAGE_GLOBS,
  createNodeId,
  dedupeBy,
  inferAnonymousExportName,
  parseModule,
  relativeFilePath,
  resolveProjectFiles
} from "./shared.js";

export function findPages(projectRoot: string): PageNode[] {
  const pages: PageNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, PAGE_GLOBS)) {
    try {
      const module = parseModule(filePath);
      const relativePath = relativeFilePath(projectRoot, filePath);
      const fallbackName = path.basename(filePath, path.extname(filePath)) === "page"
        ? inferAnonymousExportName(filePath)
        : path.basename(filePath, path.extname(filePath));

      let name = fallbackName;
      for (const statement of (module.ast as TSESTree.Program).body) {
        if (statement.type !== "ExportDefaultDeclaration") {
          continue;
        }

        const declaration = statement.declaration;
        if (declaration.type === "Identifier") {
          name = declaration.name;
        } else if (
          (declaration.type === "FunctionDeclaration" || declaration.type === "ClassDeclaration") &&
          declaration.id
        ) {
          name = declaration.id.name;
        } else {
          name = inferAnonymousExportName(filePath);
        }
        break;
      }

      pages.push({
        id: createNodeId("page", relativePath),
        name,
        filePath: relativePath,
        type: "page"
      });
    } catch (err) {
      console.warn(`[ReactGraph] Skipping ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(pages, (page) => page.id);
}
