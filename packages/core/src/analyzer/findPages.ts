import fs from "node:fs";
import path from "node:path";
import type { TSESTree } from "@typescript-eslint/types";
import type { PageNode } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
  inferAnonymousExportName,
  isPageLikeFile,
  parseModule,
  relativeFilePath,
  resolveProjectFiles
} from "./shared.js";

export function detectProjectType(projectRoot: string): "nextjs" | "expo" | "react" {
  const packageJsonPath = path.join(projectRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return "react";
  }

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

  if (deps.expo) {
    return "expo";
  }
  if (deps.next) {
    return "nextjs";
  }
  return "react";
}

export function findPages(projectRoot: string): PageNode[] {
  const pages: PageNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, TS_GLOBS)) {
    try {
      const module = parseModule(filePath);
      const relativePath = relativeFilePath(projectRoot, filePath);
      if (!isPageLikeFile(relativePath, module)) {
        continue;
      }

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
