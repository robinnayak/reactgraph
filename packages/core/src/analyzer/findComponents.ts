import type { TSESTree } from "@typescript-eslint/types";
import type { ComponentNode } from "../types.js";
import {
  JSX_GLOBS,
  createNodeId,
  dedupeBy,
  extractPropsFromTypeAliasOrInterface,
  getTypeText,
  inferAnonymousExportName,
  isLikelyComponentName,
  looksLikeJsxReturningFunction,
  parseModule,
  relativeFilePath,
  resolveProjectFiles
} from "./shared.js";

function getFunctionParamTypeName(
  fn:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
): string | undefined {
  const firstParam = fn.params[0];
  if (!firstParam) {
    return undefined;
  }

  if (firstParam.type === "Identifier") {
    const annotation = firstParam.typeAnnotation?.typeAnnotation;
    if (annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier") {
      return annotation.typeName.name;
    }
  }

  if (firstParam.type === "ObjectPattern") {
    const annotation = firstParam.typeAnnotation?.typeAnnotation;
    if (annotation?.type === "TSTypeReference" && annotation.typeName.type === "Identifier") {
      return annotation.typeName.name;
    }
  }

  return undefined;
}

export function findComponents(projectRoot: string): ComponentNode[] {
  const components: ComponentNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, JSX_GLOBS)) {
    const relativePath = relativeFilePath(projectRoot, filePath);
    if (/^pages\/.*\.tsx$/.test(relativePath) || /^app\/(?:.*\/)?page\.tsx$/.test(relativePath)) {
      continue;
    }

    try {
      const module = parseModule(filePath);
      const typeMap = new Map<string, ComponentNode["props"]>();

      for (const statement of (module.ast as TSESTree.Program).body) {
        if (
          statement.type === "TSTypeAliasDeclaration" ||
          statement.type === "TSInterfaceDeclaration"
        ) {
          typeMap.set(statement.id.name, extractPropsFromTypeAliasOrInterface(statement, module.source));
        }
      }

      const pushComponent = (
        name: string,
        fn:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression
      ) => {
        if (!isLikelyComponentName(name) || !looksLikeJsxReturningFunction(fn)) {
          return;
        }

        const propsTypeName = getFunctionParamTypeName(fn);
        const props = propsTypeName ? typeMap.get(propsTypeName) ?? [] : [];

        components.push({
          id: createNodeId("component", relativePath),
          name,
          filePath: relativePath,
          type: "component",
          props,
          isShared: false,
          usedInPages: []
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
              pushComponent(declaration.id.name, declaration.init);
            }
          }
        }
      };

      for (const statement of (module.ast as TSESTree.Program).body) {
        if (statement.type === "FunctionDeclaration" && statement.id) {
          const isExported = module.exports.has(statement.id.name) || module.defaultExportName === statement.id.name;
          if (isExported) {
            pushComponent(statement.id.name, statement);
          }
        }

        if (statement.type === "VariableDeclaration") {
          handleVariableDeclaration(statement);
        }

        if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
          if (statement.declaration.type === "FunctionDeclaration" && statement.declaration.id) {
            pushComponent(statement.declaration.id.name, statement.declaration);
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
          pushComponent(inferAnonymousExportName(filePath), declaration);
        } else if (declaration.type === "FunctionDeclaration") {
          pushComponent(declaration.id?.name ?? inferAnonymousExportName(filePath), declaration);
        }
      }
      }
    } catch (err) {
      console.warn(`[ReactGraph] Skipping ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(components, (component) => component.id);
}
