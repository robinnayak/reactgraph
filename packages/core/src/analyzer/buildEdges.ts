import path from "node:path";
import type { TSESTree } from "@typescript-eslint/types";
import type { ApiNode, ComponentNode, Edge, HookNode, PageNode, Prop } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
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

interface EdgeSeed {
  source: string;
  target: string;
  relationshipType: Edge["relationshipType"];
  props?: Prop[];
}

type ReachabilityMap = Map<string, Set<string>>;

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

function getJsxTagName(name: TSESTree.JSXTagNameExpression): string | undefined {
  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  if (name.type === "JSXMemberExpression") {
    return name.property.name;
  }

  return undefined;
}

function getTargetComponentFromJsx(
  openingElement: TSESTree.JSXOpeningElement,
  imports: Map<string, string>,
  currentFile: string,
  lookup: NodeLookup,
  projectRoot: string
): ComponentNode | undefined {
  const tagName = getJsxTagName(openingElement.name);
  if (!tagName || tagName[0] !== tagName[0].toUpperCase()) {
    return undefined;
  }

  const importSource = imports.get(tagName);
  if (importSource) {
    const importedFile = resolveImportToFile(currentFile, importSource);
    if (importedFile) {
      const relative = relativeFilePath(projectRoot, importedFile);
      return lookup.componentsByFile.get(relative) ?? lookup.componentsByName.get(tagName);
    }
  }

  return lookup.componentsByName.get(tagName);
}

function propsFromJsx(openingElement: TSESTree.JSXOpeningElement, source: string): Prop[] {
  return (openingElement.attributes ?? []).flatMap((attribute) => {
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
      return [
        {
          name: attribute.name.name,
          type: expression ? inferTypeFromExpression(expression as TSESTree.Expression, source) : "unknown",
          required: true
        }
      ];
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

function getFetchMethod(node: TSESTree.CallExpression): ApiNode["method"] {
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

function collectApiCall(
  node: TSESTree.CallExpression,
  source: string
): { endpoint: string; method: ApiNode["method"] } | undefined {
  if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
    const endpoint = getStringValue(node.arguments[0] as TSESTree.Node | undefined, source);
    if (endpoint) {
      return { endpoint, method: getFetchMethod(node) };
    }
  }

  if (
    node.callee.type === "MemberExpression" &&
    node.callee.object.type === "Identifier" &&
    node.callee.property.type === "Identifier"
  ) {
    const method = node.callee.property.name.toUpperCase();
    if (method === "GET" || method === "POST" || method === "PUT" || method === "DELETE") {
      const endpoint = getStringValue(node.arguments[0] as TSESTree.Node | undefined, source);
      if (endpoint) {
        return { endpoint, method: method as ApiNode["method"] };
      }
    }
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useSWR") {
    const endpoint = getStringValue(node.arguments[0] as TSESTree.Node | undefined, source);
    if (endpoint) {
      return { endpoint, method: "GET" };
    }
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useQuery") {
    const config = node.arguments[0];
    if (config?.type === "ObjectExpression") {
      let endpoint: string | undefined;
      traverse(config, (nested) => {
        if (endpoint || nested.type !== "CallExpression") {
          return;
        }

        if (nested.callee.type === "Identifier" && nested.callee.name === "fetch") {
          endpoint = getStringValue(nested.arguments[0] as TSESTree.Node | undefined, source);
        }
      });

      if (endpoint) {
        return { endpoint, method: "GET" };
      }
    }
  }

  return undefined;
}

function createEdge(seed: EdgeSeed, index: number): Edge {
  const propsKey = seed.props?.map((prop) => `${prop.name}:${prop.type}`).join(",") ?? "";
  return {
    id: `${seed.source}-${seed.target}-${index}-${Math.random().toString(36).slice(2)}`,
    source: seed.source,
    target: seed.target,
    relationshipType: seed.relationshipType,
    props: propsKey ? seed.props : undefined
  };
}

function isSharedPath(filePath: string): boolean {
  return filePath.includes("/shared/") || filePath.includes("\\shared\\");
}

function isNextjsReservedFile(filePath: string): boolean {
  const reserved = [
    "layout.tsx",
    "layout.ts",
    "error.tsx",
    "error.ts",
    "loading.tsx",
    "loading.ts",
    "not-found.tsx",
    "not-found.ts",
    "template.tsx",
    "template.ts",
    "middleware.ts",
    "middleware.tsx"
  ];
  return reserved.some((name) => filePath.endsWith(name));
}

function buildComponentUsageMap(pages: PageNode[], components: ComponentNode[], seeds: EdgeSeed[]): ReachabilityMap {
  const usageByComponentId: ReachabilityMap = new Map(components.map((component) => [component.id, new Set<string>()]));
  const childComponentsByParentId = new Map<string, string[]>();

  for (const seed of seeds) {
    if (seed.relationshipType !== "renders") {
      continue;
    }

    const children = childComponentsByParentId.get(seed.source) ?? [];
    children.push(seed.target);
    childComponentsByParentId.set(seed.source, children);
  }

  const visit = (pageId: string, ownerId: string, visited: Set<string>) => {
    for (const componentId of childComponentsByParentId.get(ownerId) ?? []) {
      if (visited.has(componentId)) {
        continue;
      }

      visited.add(componentId);
      usageByComponentId.get(componentId)?.add(pageId);
      visit(pageId, componentId, visited);
    }
  };

  for (const page of pages) {
    visit(page.id, page.id, new Set<string>());
  }

  return usageByComponentId;
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
  const seeds: EdgeSeed[] = [];

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
        if (!component || component.id === owner.id) {
          return;
        }

        seeds.push({
          source: owner.id,
          target: component.id,
          relationshipType: "renders",
          props: propsFromJsx(node, module.source)
        });
      }

      if (node.type === "CallExpression" && node.callee.type === "Identifier" && isHookName(node.callee.name)) {
        const hook = lookup.hooksByName.get(node.callee.name);
        if (hook && hook.id !== owner.id) {
          seeds.push({
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
        seeds.push({
          source: owner.id,
          target: createNodeId("context", contextName),
          relationshipType: "provides"
        });
      }

      if (node.type === "CallExpression") {
        const apiCall = collectApiCall(node, module.source);
        if (!apiCall) {
          return;
        }

        const api = lookup.apisByEndpoint.get(apiCall.endpoint) ?? {
          id: createNodeId("api", `${apiCall.method}:${apiCall.endpoint}`),
          endpoint: apiCall.endpoint,
          method: apiCall.method,
          type: "api" as const
        };

        seeds.push({
          source: owner.id,
          target: api.id,
          relationshipType: "calls"
        });
      }
    });
  }

  const usageByComponentId = buildComponentUsageMap(pages, components, seeds);
  const allPageIds = pages.map((page) => page.id);

  for (const component of components) {
    const isReserved = isNextjsReservedFile(component.filePath);
    const usedByPages = isReserved ? allPageIds : Array.from(usageByComponentId.get(component.id) ?? []);
    const usageCount = usedByPages.length;
    const shouldMoveToShared = usageCount >= 2 && !isSharedPath(component.filePath);
    const isUnused = !isReserved && usageCount === 0;

    component.usedInPages = usedByPages;
    component.usageCount = usageCount;
    component.isShared = usageCount >= 2;
    component.shouldMoveToShared = shouldMoveToShared;
    component.isUnused = isUnused;
    component.unusedReason = isUnused ? "Not referenced by any page or component tree" : undefined;
  }

  const dedupedSeeds = dedupeBy(
    seeds,
    (edge) =>
      `${edge.source}:${edge.target}:${edge.relationshipType}:${edge.props?.map((prop) => `${prop.name}:${prop.type}`).join("|") ?? ""}`
  );

  return dedupedSeeds.map((edge, index) => createEdge(edge, index));
}
