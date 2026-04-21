import type { TSESTree } from "@typescript-eslint/types";
import type { ApiNode } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
  expressionText,
  inferTypeFromExpression,
  parseModule,
  resolveProjectFiles,
  traverse
} from "./shared.js";

type Method = ApiNode["method"];

function createApiNode(endpoint: string, method: Method, payload?: Record<string, string>): ApiNode {
  return {
    id: createNodeId("api", `${method}:${endpoint}`),
    endpoint,
    method,
    type: "api",
    payload
  };
}

function getStringArgument(node: TSESTree.CallExpression, index: number): string | undefined {
  const argument = node.arguments[index];
  if (!argument || argument.type !== "Literal" || typeof argument.value !== "string") {
    return undefined;
  }
  return argument.value;
}

function getPayloadFromArgument(
  argument: TSESTree.CallExpressionArgument | TSESTree.SpreadElement | undefined,
  source: string
): Record<string, string> | undefined {
  if (!argument || argument.type !== "ObjectExpression") {
    return undefined;
  }

  const payload: Record<string, string> = {};
  for (const property of argument.properties) {
    if (property.type === "Property" && property.key.type === "Identifier") {
      payload[property.key.name] = inferTypeFromExpression(property.value as TSESTree.Expression, source);
    }
  }
  return Object.keys(payload).length > 0 ? payload : undefined;
}

export function findApis(projectRoot: string): ApiNode[] {
  const apis: ApiNode[] = [];

  for (const filePath of resolveProjectFiles(projectRoot, TS_GLOBS)) {
    try {
      const module = parseModule(filePath);

      traverse(module.ast, (node) => {
        if (node.type !== "CallExpression") {
          return;
        }

        if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
          const endpoint = getStringArgument(node, 0);
          if (!endpoint?.startsWith("/api/")) {
            return;
          }

          let method: Method = "GET";
          const optionsArg = node.arguments[1];
          if (optionsArg?.type === "ObjectExpression") {
            for (const property of optionsArg.properties) {
              if (
                property.type === "Property" &&
                property.key.type === "Identifier" &&
                property.key.name === "method" &&
                property.value.type === "Literal" &&
                typeof property.value.value === "string"
              ) {
                const upper = property.value.value.toUpperCase();
                if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "DELETE") {
                  method = upper;
                }
              }
            }
          }

          apis.push(createApiNode(endpoint, method));
          return;
        }

        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "axios" &&
          node.callee.property.type === "Identifier"
        ) {
          const propertyName = node.callee.property.name.toUpperCase();
          if (!["GET", "POST", "PUT", "DELETE"].includes(propertyName)) {
            return;
          }
          const endpoint = getStringArgument(node, 0);
          if (!endpoint) {
            return;
          }
          apis.push(createApiNode(endpoint, propertyName as Method, getPayloadFromArgument(node.arguments[1], module.source)));
          return;
        }

        if (node.callee.type === "Identifier" && node.callee.name === "useSWR") {
          const endpoint = getStringArgument(node, 0);
          if (endpoint) {
            apis.push(createApiNode(endpoint, "GET"));
          }
          return;
        }

        if (node.callee.type === "Identifier" && node.callee.name === "useQuery") {
          const first = node.arguments[0];
          if (first?.type === "ObjectExpression") {
            for (const property of first.properties) {
              if (
                property.type === "Property" &&
                property.key.type === "Identifier" &&
                property.key.name === "queryKey" &&
                property.value.type === "ArrayExpression"
              ) {
                let literal: TSESTree.Literal | undefined;
                for (const element of property.value.elements) {
                  if (element && element.type === "Literal" && typeof element.value === "string") {
                    literal = element;
                    break;
                  }
                }
                if (literal) {
                  apis.push(createApiNode(String(literal.value), "GET"));
                }
              }
            }
          } else {
            const endpoint = expressionText(first as TSESTree.Node, module.source);
            if (endpoint?.includes("/api/")) {
              apis.push(createApiNode(endpoint.replace(/^['"`]|['"`]$/g, ""), "GET"));
            }
          }
        }
      });
    } catch (err) {
      console.warn(`[ReactGraph] Skipping ${filePath}: ${(err as Error).message}`);
    }
  }

  return dedupeBy(apis, (api) => api.id);
}
