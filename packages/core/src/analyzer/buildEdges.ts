import path from "node:path";
import type { TSESTree } from "@typescript-eslint/types";
import type { ApiNode, ComponentNode, Edge, HookNode, PageNode, Prop } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
  expressionText,
  getTypeText,
  inferTypeFromExpression,
  isHookName,
  parseModule,
  relativeFilePath,
  resolveImportToFile,
  resolveProjectFiles,
  traverse
} from "./shared.js";

interface NodeLookup {
  pagesByFile: Map<string, PageNode>;
  componentsByFile: Map<string, ComponentNode>;
  componentsByName: Map<string, ComponentNode>;
  hooksByFile: Map<string, HookNode>;
  hooksByName: Map<string, HookNode>;
  apisByEndpoint: Map<string, ApiNode>;
}

function buildLookup(
  pages: PageNode[],
  components: ComponentNode[],
  hooks: HookNode[],
  apis: ApiNode[]
): NodeLookup {
  return {
    pagesByFile: new Map(pages.map((page) => [page.filePath, page])),
    componentsByFile: new Map(components.map((component) => [component.filePath, component])),
    componentsByName: new Map(components.map((component) => [component.name, component])),
    hooksByFile: new Map(hooks.map((hook) => [hook.filePath, hook])),
    hooksByName: new Map(hooks.map((hook) => [hook.name, hook])),
    apisByEndpoint: new Map(apis.map((api) => [api.endpoint, api]))
  };
}

function getTargetComponentFromJsx(
  openingElement: TSESTree.JSXOpeningElement,
  imports: Map<string, string>,
  currentFile: string,
  lookup: NodeLookup,
  projectRoot: string
): ComponentNode | undefined {
  const tagName =
    openingElement.name.type === "JSXIdentifier" ? openingElement.name.name : undefined;
  if (!tagName || tagName[0] !== tagName[0].toUpperCase()) {
    return undefined;
  }

  const importSource = imports.get(tagName);
  if (importSource) {
    const importedFile = resolveImportToFile(currentFile, importSource);
    if (importedFile) {
      const relative = relativeFilePath(projectRoot, importedFile);
      return lookup.componentsByFile.get(relative);
    }
  }

  return lookup.componentsByName.get(tagName);
}

function propsFromJsx(openingElement: TSESTree.JSXOpeningElement, source: string): Prop[] {
  return openingElement.attributes.flatMap((attribute) => {
    if (attribute.type !== "JSXAttribute" || attribute.name.type !== "JSXIdentifier") {
      return [];
    }
    const value = attribute.value;
    if (!value) {
      return [{ name: attribute.name.name, type: "boolean", required: true }];
    }
    if (value.type === "Literal") {
      return [{ name: attribute.name.name, type: typeof value.value, required: true }];
    }
    if (value.type === "JSXExpressionContainer") {
      const expression = value.expression.type === "JSXEmptyExpression" ? undefined : value.expression;
      const type =
        expression ? inferTypeFromExpression(expression as TSESTree.Expression | undefined, source) : "unknown";
      return [{ name: attribute.name.name, type, required: true }];
    }
    return [{ name: attribute.name.name, type: "string", required: true }];
  });
}

function findParentOwner(
  currentRelativePath: string,
  lookup: NodeLookup
): PageNode | ComponentNode | HookNode | undefined {
  return (
    lookup.pagesByFile.get(currentRelativePath) ??
    lookup.componentsByFile.get(currentRelativePath) ??
    lookup.hooksByFile.get(currentRelativePath)
  );
}

function collectApiCalls(
  node: TSESTree.CallExpression,
  source: string
): { endpoint: string; method: ApiNode["method"] } | undefined {
  if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
    const endpoint = node.arguments[0];
    if (endpoint?.type === "Literal" && typeof endpoint.value === "string") {
      let method: ApiNode["method"] = "GET";
      const options = node.arguments[1];
      if (options?.type === "ObjectExpression") {
        for (const property of options.properties) {
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
      return { endpoint: endpoint.value, method };
    }
  }

  if (
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "axios" &&
    node.callee.property.type === "Identifier"
  ) {
    const endpoint = node.arguments[0];
    if (endpoint?.type === "Literal" && typeof endpoint.value === "string") {
      const upper = node.callee.property.name.toUpperCase();
      if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "DELETE") {
        return { endpoint: endpoint.value, method: upper };
      }
    }
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useSWR") {
    const endpoint = node.arguments[0];
    if (endpoint?.type === "Literal" && typeof endpoint.value === "string") {
      return { endpoint: endpoint.value, method: "GET" };
    }
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useQuery") {
    const text = expressionText(node.arguments[0] as TSESTree.Node | undefined, source);
    if (text?.includes("/api/")) {
      return { endpoint: text.replace(/^[`'"]|[`'"]$/g, ""), method: "GET" };
    }
  }

  return undefined;
}

export function buildEdges(
  pages: PageNode[],
  components: ComponentNode[],
  hooks: HookNode[],
  apis: ApiNode[],
  projectRoot?: string
): Edge[] {
  const root = projectRoot ?? process.cwd();
  const lookup = buildLookup(pages, components, hooks, apis);
  const edges: Edge[] = [];
  const usedInPages = new Map<string, Set<string>>();

  for (const filePath of resolveProjectFiles(root, TS_GLOBS)) {
    const module = parseModule(filePath);
    const currentRelativePath = relativeFilePath(root, filePath);
    const owner = findParentOwner(currentRelativePath, lookup);
    if (!owner) {
      continue;
    }

    traverse(module.ast, (node) => {
      if (node.type === "JSXOpeningElement") {
        const component = getTargetComponentFromJsx(node, module.imports, filePath, lookup, root);
        if (!component) {
          return;
        }
        const props = propsFromJsx(node, module.source);
        edges.push({
          id: createNodeId("edge", `${owner.id}->${component.id}:renders:${props.map((prop) => prop.name).join(",")}`),
          source: owner.id,
          target: component.id,
          relationshipType: "renders",
          props
        });

        if (owner.type === "page") {
          if (!usedInPages.has(component.id)) {
            usedInPages.set(component.id, new Set());
          }
          usedInPages.get(component.id)?.add(owner.id);
        }
      }

      if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        isHookName(node.callee.name)
      ) {
        const hook = lookup.hooksByName.get(node.callee.name);
        if (hook) {
          edges.push({
            id: createNodeId("edge", `${owner.id}->${hook.id}:uses`),
            source: owner.id,
            target: hook.id,
            relationshipType: "uses"
          });
        }
      }

      if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier" &&
        node.callee.name === "useContext"
      ) {
        const firstArg = node.arguments[0];
        const contextName =
          firstArg?.type === "Identifier"
            ? firstArg.name
            : path.basename(filePath, path.extname(filePath));
        const contextId = createNodeId("context", contextName);
        edges.push({
          id: createNodeId("edge", `${owner.id}->${contextId}:provides`),
          source: owner.id,
          target: contextId,
          relationshipType: "provides"
        });
      }

      if (node.type === "CallExpression" && owner.type === "hook") {
        const apiCall = collectApiCalls(node, module.source);
        if (!apiCall) {
          return;
        }
        const api = lookup.apisByEndpoint.get(apiCall.endpoint) ?? {
          id: createNodeId("api", `${apiCall.method}:${apiCall.endpoint}`),
          endpoint: apiCall.endpoint,
          method: apiCall.method,
          type: "api" as const
        };
        edges.push({
          id: createNodeId("edge", `${owner.id}->${api.id}:calls`),
          source: owner.id,
          target: api.id,
          relationshipType: "calls"
        });
      }
    });
  }

  for (const component of components) {
    const usedByPages = Array.from(usedInPages.get(component.id) ?? []);
    component.usedInPages = usedByPages;
    component.isShared = usedByPages.length >= 2;
  }

  return dedupeBy(edges, (edge) => edge.id);
}
