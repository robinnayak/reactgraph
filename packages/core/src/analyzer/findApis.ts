import type { TSESTree } from "@typescript-eslint/types";
import type { ApiNode } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
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

function normalizeEndpoint(raw: string | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const endpoint = raw.trim();
  if (endpoint.startsWith("/api/") || endpoint.startsWith("/")) {
    return endpoint;
  }

  return undefined;
}

function getStringValue(node: TSESTree.Node | undefined, source: string): string | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
  }

  if (node.range) {
    const text = source.slice(node.range[0], node.range[1]).trim();
    if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith("\"") && text.endsWith("\""))) {
      return text.slice(1, -1);
    }
    if (text.startsWith("`") && text.endsWith("`")) {
      return text.slice(1, -1);
    }
  }

  return undefined;
}

function getMethodFromOptions(node: TSESTree.CallExpression): Method {
  const optionsArg = node.arguments[1];
  if (optionsArg?.type !== "ObjectExpression") {
    return "GET";
  }

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
        return upper;
      }
    }
  }

  return "GET";
}

function getQueryEndpoint(config: TSESTree.ObjectExpression, source: string): string | undefined {
  for (const property of config.properties) {
    if (property.type !== "Property" || property.key.type !== "Identifier") {
      continue;
    }

    if (property.key.name === "queryFn") {
      const fn = property.value;
      if (fn.type === "ArrowFunctionExpression" || fn.type === "FunctionExpression") {
        let endpoint: string | undefined;
        traverse(fn.body, (node) => {
          if (endpoint || node.type !== "CallExpression") {
            return;
          }

          if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
            endpoint = normalizeEndpoint(getStringValue(node.arguments[0] as TSESTree.Node | undefined, source));
          }
        });
        if (endpoint) {
          return endpoint;
        }
      }
    }

    if (property.key.name === "queryKey" && property.value.type === "ArrayExpression") {
      for (const element of property.value.elements) {
        const endpoint = normalizeEndpoint(getStringValue(element as TSESTree.Node | undefined, source));
        if (endpoint) {
          return endpoint;
        }
      }
    }
  }

  return undefined;
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
          const endpoint = normalizeEndpoint(getStringValue(node.arguments[0] as TSESTree.Node | undefined, module.source));
          if (endpoint) {
            apis.push(createApiNode(endpoint, getMethodFromOptions(node)));
          }
          return;
        }

        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.object.type === "Identifier"
        ) {
          const method = node.callee.property.name.toUpperCase();
          if (!["GET", "POST", "PUT", "DELETE"].includes(method)) {
            return;
          }

          const endpoint = normalizeEndpoint(getStringValue(node.arguments[0] as TSESTree.Node | undefined, module.source));
          if (!endpoint) {
            return;
          }

          apis.push(createApiNode(endpoint, method as Method, getPayloadFromArgument(node.arguments[1], module.source)));
          return;
        }

        if (node.callee.type === "Identifier" && node.callee.name === "useSWR") {
          const endpoint = normalizeEndpoint(getStringValue(node.arguments[0] as TSESTree.Node | undefined, module.source));
          if (endpoint) {
            apis.push(createApiNode(endpoint, "GET"));
          }
          return;
        }

        if (node.callee.type === "Identifier" && node.callee.name === "useQuery") {
          const firstArg = node.arguments[0];
          if (firstArg?.type === "ObjectExpression") {
            const endpoint = getQueryEndpoint(firstArg, module.source);
            if (endpoint) {
              apis.push(createApiNode(endpoint, "GET"));
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
