import type { TSESTree } from "@typescript-eslint/types";
import type { ComponentNode } from "../types.js";
import {
  JSX_GLOBS,
  createNodeId,
  dedupeBy,
  extractPropsFromMembers,
  extractPropsFromTypeAliasOrInterface,
  getTypeMembers,
  inferAnonymousExportName,
  isLikelyComponentName,
  looksLikeJsxReturningFunction,
  parseModule,
  relativeFilePath,
  resolveProjectFiles
} from "./shared.js";

function getReferenceName(typeName: TSESTree.EntityName): string | undefined {
  if (typeName.type === "Identifier") {
    return typeName.name;
  }

  if (typeName.type === "TSQualifiedName") {
    return typeName.right.name;
  }

  return undefined;
}

function extractPropsFromTypeNode(
  typeNode: TSESTree.TypeNode | undefined,
  propsTypeMap: Map<string, ComponentNode["props"]>,
  source: string
): ComponentNode["props"] {
  if (!typeNode) {
    return [];
  }

  if (typeNode.type === "TSTypeReference") {
    const typeName = getReferenceName(typeNode.typeName);
    if (!typeName) {
      return [];
    }

    if (typeName === "FC" || typeName === "FunctionComponent") {
      return extractPropsFromTypeNode(typeNode.typeArguments?.params[0], propsTypeMap, source);
    }

    return propsTypeMap.get(typeName) ?? [];
  }

  const members = getTypeMembers(typeNode);
  return members.length > 0 ? extractPropsFromMembers(members, source) : [];
}

function getFunctionParamProps(
  fn:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
  propsTypeMap: Map<string, ComponentNode["props"]>,
  source: string
): ComponentNode["props"] {
  const firstParam = fn.params[0];
  if (!firstParam) {
    return [];
  }

  if (firstParam.type !== "Identifier" && firstParam.type !== "ObjectPattern") {
    return [];
  }

  return extractPropsFromTypeNode(firstParam.typeAnnotation?.typeAnnotation, propsTypeMap, source);
}

function getVariableTypeProps(
  declaration: TSESTree.VariableDeclarator,
  propsTypeMap: Map<string, ComponentNode["props"]>,
  source: string
): ComponentNode["props"] {
  if (declaration.id.type !== "Identifier") {
    return [];
  }

  return extractPropsFromTypeNode(declaration.id.typeAnnotation?.typeAnnotation, propsTypeMap, source);
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
          (statement.type === "TSTypeAliasDeclaration" || statement.type === "TSInterfaceDeclaration") &&
          /Props$/.test(statement.id.name)
        ) {
          typeMap.set(statement.id.name, extractPropsFromTypeAliasOrInterface(statement, module.source));
        }
      }

      const pushComponent = (
        name: string,
        fn:
          | TSESTree.FunctionDeclaration
          | TSESTree.FunctionExpression
          | TSESTree.ArrowFunctionExpression,
        props: ComponentNode["props"]
      ) => {
        if (!isLikelyComponentName(name) || !looksLikeJsxReturningFunction(fn)) {
          return;
        }

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
              const functionProps = getFunctionParamProps(declaration.init, typeMap, module.source);
              const props =
                functionProps.length > 0 ? functionProps : getVariableTypeProps(declaration, typeMap, module.source);
              pushComponent(declaration.id.name, declaration.init, props);
            }
          }
        }
      };

      for (const statement of (module.ast as TSESTree.Program).body) {
        if (statement.type === "FunctionDeclaration" && statement.id) {
          const isExported = module.exports.has(statement.id.name) || module.defaultExportName === statement.id.name;
          if (isExported) {
            pushComponent(statement.id.name, statement, getFunctionParamProps(statement, typeMap, module.source));
          }
        }

        if (statement.type === "VariableDeclaration") {
          handleVariableDeclaration(statement);
        }

        if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
          if (statement.declaration.type === "FunctionDeclaration" && statement.declaration.id) {
            pushComponent(
              statement.declaration.id.name,
              statement.declaration,
              getFunctionParamProps(statement.declaration, typeMap, module.source)
            );
          }
          if (statement.declaration.type === "VariableDeclaration") {
            handleVariableDeclaration(statement.declaration);
          }
        }

        if (statement.type === "ExportDefaultDeclaration") {
          const declaration = statement.declaration;
          if (declaration.type === "ArrowFunctionExpression" || declaration.type === "FunctionExpression") {
            pushComponent(
              inferAnonymousExportName(filePath),
              declaration,
              getFunctionParamProps(declaration, typeMap, module.source)
            );
          } else if (declaration.type === "FunctionDeclaration") {
            pushComponent(
              declaration.id?.name ?? inferAnonymousExportName(filePath),
              declaration,
              getFunctionParamProps(declaration, typeMap, module.source)
            );
          }
        }
      }
    } catch (err) {
      console.warn(`[ReactGraph] Falling back to empty props for ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(components, (component) => component.id);
}
