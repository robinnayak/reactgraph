import path from "node:path";
import type { TSESTree } from "@typescript-eslint/types";
import type { ApiNode, ComponentNode, Edge, HookNode, PageNode, Prop, PropDrillingDetail } from "../types.js";
import {
  TS_GLOBS,
  createNodeId,
  dedupeBy,
  inferTypeFromExpression,
  isFrameworkReservedFile,
  isHookName,
  parseModule,
  relativeFilePath,
  resolveImportToFile,
  resolveProjectFiles,
  traverse
} from "./shared.js";

interface NodeLookup {
  pagesByFile: Map<string, PageNode>;
  pagesByName: Map<string, PageNode>;
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

interface ImportBinding {
  localName: string;
  importSource: string;
  importedName: string;
}

interface ResolvedImportUsage {
  componentIds: string[];
  viaBarrel: boolean;
}

const FRAMEWORK_FILE_PATTERNS = [
  /\/app\/layout\.[tj]sx?$/,
  /\/app\/loading\.[tj]sx?$/,
  /\/app\/error\.[tj]sx?$/,
  /\/app\/not-found\.[tj]sx?$/,
  /\/app\/template\.[tj]sx?$/,
  /\/middleware\.[tj]sx?$/,
  /\/pages\/_app\.[tj]sx?$/,
  /\/pages\/_document\.[tj]sx?$/
];

function isFrameworkFile(filePath: string): boolean {
  const normalized = `/${filePath.replace(/\\/g, "/").replace(/^\/+/, "")}`;
  return FRAMEWORK_FILE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function buildLookup(
  pages: PageNode[],
  components: ComponentNode[],
  hooks: HookNode[],
  apis: ApiNode[]
): NodeLookup {
  return {
    pagesByFile: new Map(pages.map((page) => [page.filePath, page])),
    pagesByName: new Map(pages.map((page) => [page.name, page])),
    componentsByFile: new Map(components.map((component) => [component.filePath, component])),
    componentsByName: new Map(components.map((component) => [component.name, component])),
    hooksByFile: new Map(hooks.map((hook) => [hook.filePath, hook])),
    hooksByName: new Map(hooks.map((hook) => [hook.name, hook])),
    apisByEndpoint: new Map(apis.map((api) => [api.endpoint, api]))
  };
}

function getImportBindings(module: ReturnType<typeof parseModule>): ImportBinding[] {
  const bindings: ImportBinding[] = [];

  for (const statement of (module.ast as TSESTree.Program).body) {
    if (statement.type !== "ImportDeclaration" || typeof statement.source.value !== "string") {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier") {
        bindings.push({
          localName: specifier.local.name,
          importSource: statement.source.value,
          importedName: specifier.imported.type === "Identifier" ? specifier.imported.name : specifier.imported.value
        });
        continue;
      }

      if (specifier.type === "ImportDefaultSpecifier") {
        bindings.push({
          localName: specifier.local.name,
          importSource: statement.source.value,
          importedName: "default"
        });
      }
    }
  }

  return bindings;
}

function isBarrelFile(filePath: string): boolean {
  return /(?:^|[\\/])index\.(ts|tsx)$/.test(filePath);
}

function collectExportedNamesFromDeclaration(declaration: TSESTree.Node): string[] {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((entry) => (entry.id.type === "Identifier" ? [entry.id.name] : []));
  }

  if ("id" in declaration && declaration.id?.type === "Identifier") {
    return [declaration.id.name];
  }

  return [];
}

function resolveImportTargets(
  fromFile: string,
  importSource: string,
  importedName: string,
  lookup: NodeLookup,
  projectRoot: string,
  cache: Map<string, ResolvedImportUsage>
): ResolvedImportUsage {
  if (!importSource.startsWith(".")) {
    return { componentIds: [], viaBarrel: false };
  }

  const cacheKey = `${fromFile}::${importSource}::${importedName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const resolvedFile = resolveImportToFile(fromFile, importSource);
  if (!resolvedFile) {
    const empty = { componentIds: [], viaBarrel: false };
    cache.set(cacheKey, empty);
    return empty;
  }

  const directComponent = lookup.componentsByFile.get(relativeFilePath(projectRoot, resolvedFile));
  if (!isBarrelFile(resolvedFile)) {
    const direct = { componentIds: directComponent ? [directComponent.id] : [], viaBarrel: false };
    cache.set(cacheKey, direct);
    return direct;
  }

  const resolvedComponentIds = new Set<string>();
  let resolvedViaBarrel = false;

  try {
    const barrelModule = parseModule(resolvedFile);
    for (const statement of (barrelModule.ast as TSESTree.Program).body) {
      if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
        const declaredNames = collectExportedNamesFromDeclaration(statement.declaration);
        if (importedName === "default" ? barrelModule.defaultExportName != null : declaredNames.includes(importedName)) {
          if (directComponent) {
            resolvedComponentIds.add(directComponent.id);
          }
        }
        continue;
      }

      if (
        statement.type === "ExportNamedDeclaration" &&
        statement.source &&
        typeof statement.source.value === "string"
      ) {
        for (const specifier of statement.specifiers) {
          const exportedName =
            specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value;
          if (exportedName !== importedName) {
            continue;
          }

          resolvedViaBarrel = true;
          const reexportedName =
            specifier.local.type === "Identifier"
              ? specifier.local.name
              : specifier.local.type === "Literal"
                ? String(specifier.local.value)
                : "default";
          const nested = resolveImportTargets(
            resolvedFile,
            statement.source.value,
            reexportedName,
            lookup,
            projectRoot,
            cache
          );
          nested.componentIds.forEach((componentId) => resolvedComponentIds.add(componentId));
        }
      }
    }
  } catch {
    // Ignore barrel parse failures and fall back to the barrel file itself when possible.
  }

  if (resolvedComponentIds.size === 0 && directComponent) {
    resolvedComponentIds.add(directComponent.id);
  }

  const resolved = {
    componentIds: Array.from(resolvedComponentIds),
    viaBarrel: resolvedViaBarrel
  };
  cache.set(cacheKey, resolved);
  return resolved;
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

function getEndpointValue(node: TSESTree.Node | undefined, source: string): string | undefined {
  if (!node) {
    return undefined;
  }

  if (node.type === "TemplateLiteral") {
    const cooked = node.quasis.map((quasi) => quasi.value.cooked ?? "").join("");
    if (node.expressions.length > 0 && cooked.startsWith("/")) {
      return cooked;
    }
  }

  return getStringValue(node, source);
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
    const endpoint = getEndpointValue(node.arguments[0] as TSESTree.Node | undefined, source);
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
      const endpoint = getEndpointValue(node.arguments[0] as TSESTree.Node | undefined, source);
      if (endpoint) {
        return { endpoint, method: method as ApiNode["method"] };
      }
    }
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useSWR") {
    const endpoint = getEndpointValue(node.arguments[0] as TSESTree.Node | undefined, source);
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
          endpoint = getEndpointValue(nested.arguments[0] as TSESTree.Node | undefined, source);
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

function normalizeRouteSegment(value: string): string {
  return value.replace(/^\//, "").replace(/\.(tsx?|jsx?)$/, "").replace(/[\[\]()]/g, "").toLowerCase();
}

function findPageByRoute(pathname: string, pages: PageNode[]): PageNode | undefined {
  const normalizedRoute = normalizeRouteSegment(pathname);
  if (!normalizedRoute) {
    return pages.find((page) => /(?:^|\/)(index|page)\.tsx?$/.test(page.filePath));
  }

  return pages.find((page) => {
    const normalizedPath = page.filePath
      .replace(/\\/g, "/")
      .replace(/^src\//, "")
      .replace(/\.(tsx?|jsx?)$/, "")
      .replace(/\/(page|index)$/, "")
      .replace(/^app\//, "")
      .replace(/^pages\//, "")
      .replace(/^screens\//, "")
      .replace(/^views\//, "")
      .replace(/^routes\//, "")
      .toLowerCase();

    return normalizedPath === normalizedRoute || normalizedPath.endsWith(`/${normalizedRoute}`);
  });
}

function findScreenComponentByName(name: string, lookup: NodeLookup): ComponentNode | undefined {
  const normalized = name.toLowerCase();
  return (
    lookup.componentsByName.get(name) ??
    Array.from(lookup.componentsByFile.values()).find((component) => {
      const baseName = path.basename(component.filePath, path.extname(component.filePath)).toLowerCase();
      return (
        component.name.toLowerCase() === normalized ||
        baseName === normalized ||
        baseName === `${normalized}screen`
      );
    })
  );
}

function findNavigationTarget(name: string, lookup: NodeLookup): PageNode | ComponentNode | undefined {
  const normalized = name.toLowerCase();
  return (
    lookup.pagesByName.get(name) ??
    Array.from(lookup.pagesByFile.values()).find((page) => {
      const baseName = path.basename(page.filePath, path.extname(page.filePath)).toLowerCase();
      return page.name.toLowerCase() === normalized || baseName === normalized || baseName === `${normalized}screen`;
    }) ??
    findScreenComponentByName(name, lookup)
  );
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

function buildRenderReachability(rootIds: string[], components: ComponentNode[], seeds: EdgeSeed[]): Set<string> {
  const reachable = new Set<string>();
  const componentById = new Set(components.map((component) => component.id));
  const childComponentsByParentId = new Map<string, string[]>();

  for (const seed of seeds) {
    if (seed.relationshipType !== "renders" || !componentById.has(seed.target)) {
      continue;
    }

    const children = childComponentsByParentId.get(seed.source) ?? [];
    children.push(seed.target);
    childComponentsByParentId.set(seed.source, children);
  }

  const visit = (ownerId: string) => {
    for (const componentId of childComponentsByParentId.get(ownerId) ?? []) {
      if (reachable.has(componentId)) {
        continue;
      }

      reachable.add(componentId);
      visit(componentId);
    }
  };

  rootIds.forEach((rootId) => visit(rootId));
  return reachable;
}

function getCanonicalCycleIds(cycleIds: string[]): string[] {
  const uniqueCycle = cycleIds.slice(0, -1);
  const rotations = uniqueCycle.map((_, index) => {
    const rotated = [...uniqueCycle.slice(index), ...uniqueCycle.slice(0, index)];
    return [...rotated, rotated[0]];
  });

  return rotations.sort((left, right) => left.join(">").localeCompare(right.join(">")))[0] ?? cycleIds;
}

function detectCircularDependencies(components: ComponentNode[], seeds: EdgeSeed[]): Map<string, string[]> {
  const componentById = new Map(components.map((component) => [component.id, component]));
  const childrenByComponentId = new Map<string, string[]>();

  for (const seed of seeds) {
    if (
      seed.relationshipType !== "renders" ||
      !componentById.has(seed.source) ||
      !componentById.has(seed.target)
    ) {
      continue;
    }

    const children = childrenByComponentId.get(seed.source) ?? [];
    children.push(seed.target);
    childrenByComponentId.set(seed.source, children);
  }

  const cycles = new Map<string, string[]>();
  const seenCycleKeys = new Set<string>();

  const visit = (nodeId: string, path: string[]) => {
    for (const childId of childrenByComponentId.get(nodeId) ?? []) {
      const existingIndex = path.indexOf(childId);
      if (existingIndex >= 0) {
        const cycleIds = [...path.slice(existingIndex), childId];
        const canonicalCycleIds = getCanonicalCycleIds(cycleIds);
        const cycleKey = canonicalCycleIds.join(">");
        if (seenCycleKeys.has(cycleKey)) {
          continue;
        }

        seenCycleKeys.add(cycleKey);
        const chain = canonicalCycleIds.map((id) => componentById.get(id)?.name ?? id);
        for (const participantId of new Set(canonicalCycleIds.slice(0, -1))) {
          cycles.set(participantId, chain);
        }
        continue;
      }

      visit(childId, [...path, childId]);
    }
  };

  for (const component of components) {
    visit(component.id, [component.id]);
  }

  return cycles;
}

function detectPropDrilling(
  pages: PageNode[],
  components: ComponentNode[],
  seeds: EdgeSeed[]
): Map<string, PropDrillingDetail[]> {
  const componentById = new Map(components.map((component) => [component.id, component]));
  const pageIds = new Set(pages.map((page) => page.id));
  const nodeNameById = new Map<string, string>([
    ...pages.map((page) => [page.id, page.name] as const),
    ...components.map((component) => [component.id, component.name] as const)
  ]);
  const renderEdgesBySource = new Map<string, EdgeSeed[]>();
  const incomingRenderEdgeTargets = new Set<string>();

  for (const seed of seeds) {
    if (seed.relationshipType !== "renders") {
      continue;
    }

    incomingRenderEdgeTargets.add(seed.target);

    if (seed.props?.length) {
      const renderEdges = renderEdgesBySource.get(seed.source) ?? [];
      renderEdges.push(seed);
      renderEdgesBySource.set(seed.source, renderEdges);
    }
  }

  const detailsByComponentId = new Map<string, PropDrillingDetail[]>();
  const seenChains = new Set<string>();

  const recordChain = (propName: string, chainIds: string[]) => {
    if (chainIds.length < 4) {
      return;
    }

    const key = `${propName}:${chainIds.join(">")}`;
    if (seenChains.has(key)) {
      return;
    }
    seenChains.add(key);

    const detail: PropDrillingDetail = {
      propName,
      chain: chainIds.map((id) => nodeNameById.get(id) ?? id),
      depth: chainIds.length
    };

    for (const componentId of chainIds.filter((id) => componentById.has(id))) {
      const details = detailsByComponentId.get(componentId) ?? [];
      details.push(detail);
      detailsByComponentId.set(componentId, details);
    }
  };

  const extendChain = (propName: string, chainIds: string[]) => {
    const currentId = chainIds[chainIds.length - 1];
    const nextEdges = (renderEdgesBySource.get(currentId) ?? []).filter((edge) =>
      edge.props?.some((prop) => prop.name === propName)
    );
    let extended = false;

    for (const edge of nextEdges) {
      if (chainIds.includes(edge.target)) {
        continue;
      }

      extended = true;
      extendChain(propName, [...chainIds, edge.target]);
    }

    if (!extended) {
      recordChain(propName, chainIds);
    }
  };

  const drillRootEdges = seeds.filter(
    (edge) =>
      edge.relationshipType === "renders" &&
      !!edge.props?.length &&
      !incomingRenderEdgeTargets.has(edge.source)
  );

  for (const edge of drillRootEdges) {
    for (const prop of edge.props ?? []) {
      extendChain(prop.name, pageIds.has(edge.source) ? [edge.target] : [edge.source, edge.target]);
    }
  }

  return new Map(
    Array.from(detailsByComponentId.entries()).map(([componentId, details]) => {
      const deduped = new Map<string, PropDrillingDetail>();
      for (const detail of details) {
        const existing = deduped.get(detail.propName);
        if (!existing || detail.depth > existing.depth) {
          deduped.set(detail.propName, detail);
        }
      }
      return [componentId, Array.from(deduped.values())];
    })
  );
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
  const importResolutionCache = new Map<string, ResolvedImportUsage>();
  const identifierUsageByComponentId = new Set<string>();
  const barrelUsageByComponentId = new Set<string>();

  for (const filePath of resolveProjectFiles(root, TS_GLOBS)) {
    const module = parseModule(filePath);
    const currentRelativePath = relativeFilePath(root, filePath);
    const owner = findParentOwner(currentRelativePath, lookup);
    if (!owner) {
      continue;
    }

    const importBindings = getImportBindings(module);
    const resolvedBindings = new Map<string, ResolvedImportUsage>();
    for (const binding of importBindings) {
      const existing = resolvedBindings.get(binding.localName);
      const resolved = resolveImportTargets(
        filePath,
        binding.importSource,
        binding.importedName,
        lookup,
        root,
        importResolutionCache
      );

      if (existing) {
        resolved.componentIds.forEach((componentId) => {
          if (!existing.componentIds.includes(componentId)) {
            existing.componentIds.push(componentId);
          }
        });
        existing.viaBarrel ||= resolved.viaBarrel;
      } else if (resolved.componentIds.length > 0) {
        resolvedBindings.set(binding.localName, {
          componentIds: [...resolved.componentIds],
          viaBarrel: resolved.viaBarrel
        });
      }
    }

    const markIdentifierUsage = (identifierName: string) => {
      const resolved = resolvedBindings.get(identifierName);
      if (!resolved) {
        return;
      }

      resolved.componentIds.forEach((componentId) => {
        identifierUsageByComponentId.add(componentId);
        if (resolved.viaBarrel) {
          barrelUsageByComponentId.add(componentId);
        }
      });
    };

    traverse(module.ast, (node, parent) => {
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

      if (
        node.type === "JSXAttribute" &&
        node.value?.type === "JSXExpressionContainer" &&
        node.value.expression.type === "Identifier"
      ) {
        markIdentifierUsage(node.value.expression.name);
      }

      if (
        node.type === "JSXExpressionContainer" &&
        node.expression.type === "Identifier"
      ) {
        markIdentifierUsage(node.expression.name);
      }

      if (node.type === "CallExpression") {
        for (const argument of node.arguments) {
          if (argument.type === "Identifier") {
            markIdentifierUsage(argument.name);
          }
        }
      }

      if (node.type === "SpreadElement" && node.argument.type === "Identifier") {
        markIdentifierUsage(node.argument.name);
      }

      if (
        node.type === "VariableDeclarator" &&
        node.id.type === "Identifier" &&
        node.init?.type === "Identifier"
      ) {
        markIdentifierUsage(node.init.name);
        const resolved = resolvedBindings.get(node.init.name);
        if (resolved) {
          resolvedBindings.set(node.id.name, {
            componentIds: [...resolved.componentIds],
            viaBarrel: resolved.viaBarrel
          });
        }
      }

      if (
        node.type === "Identifier" &&
        parent?.type !== "ImportSpecifier" &&
        parent?.type !== "ImportDefaultSpecifier" &&
        parent?.type !== "ImportNamespaceSpecifier" &&
        parent?.type !== "ImportDeclaration" &&
        parent?.type !== "ExportSpecifier" &&
        !(parent?.type === "VariableDeclarator" && parent.id === node) &&
        !(parent?.type === "FunctionDeclaration" && parent.id === node) &&
        !(parent?.type === "ClassDeclaration" && parent.id === node) &&
        !(parent?.type === "Property" && parent.key === node && !parent.computed) &&
        !(parent?.type === "MemberExpression" && parent.property === node && !parent.computed)
      ) {
        markIdentifierUsage(node.name);
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
        if (apiCall) {
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
      }

      if (
        node.type === "JSXOpeningElement" &&
        getJsxTagName(node.name) === "Link"
      ) {
        const hrefAttribute = node.attributes.find(
          (attribute) =>
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "href"
        );
        const href =
          hrefAttribute && hrefAttribute.type === "JSXAttribute"
            ? getStringValue(
                hrefAttribute.value?.type === "JSXExpressionContainer"
                  ? hrefAttribute.value.expression
                  : hrefAttribute.value ?? undefined,
                module.source
              )
            : undefined;
        const targetPage = href ? findPageByRoute(href, pages) : undefined;
        if (targetPage && targetPage.id !== owner.id) {
          seeds.push({
            source: owner.id,
            target: targetPage.id,
            relationshipType: "navigates"
          });
        }
        return;
      }

      if (
        node.type === "CallExpression" &&
        node.callee.type === "MemberExpression" &&
        node.callee.property.type === "Identifier" &&
        node.callee.property.name === "navigate"
      ) {
        const screenName = getStringValue(node.arguments[0] as TSESTree.Node | undefined, module.source);
        const targetNode = screenName ? findNavigationTarget(screenName, lookup) : undefined;
        if (targetNode && targetNode.id !== owner.id) {
          seeds.push({
            source: owner.id,
            target: targetNode.id,
            relationshipType: "navigates"
          });
        }
        return;
      }

      if (
        node.type === "JSXOpeningElement" &&
        node.name.type === "JSXMemberExpression" &&
        node.name.property.name === "Screen"
      ) {
        const componentAttribute = node.attributes.find(
          (attribute) =>
            attribute.type === "JSXAttribute" &&
            attribute.name.type === "JSXIdentifier" &&
            attribute.name.name === "component"
        );
        if (
          componentAttribute?.type === "JSXAttribute" &&
          componentAttribute.value?.type === "JSXExpressionContainer" &&
          componentAttribute.value.expression.type === "Identifier"
        ) {
          const targetComponent = findScreenComponentByName(componentAttribute.value.expression.name, lookup);
          if (targetComponent && targetComponent.id !== owner.id) {
            seeds.push({
              source: owner.id,
              target: targetComponent.id,
              relationshipType: "renders"
            });
          }
        }
      }
    });
  }

  const usageByComponentId = buildComponentUsageMap(pages, components, seeds);
  const entryOwnerIds = components
    .filter((component) => isFrameworkReservedFile(component.filePath))
    .map((component) => component.id);
  const renderReachableComponentIds = buildRenderReachability(
    [...pages.map((page) => page.id), ...entryOwnerIds],
    components,
    seeds
  );
  const circularDependenciesByComponentId = detectCircularDependencies(components, seeds);
  const propDrillingByComponentId = detectPropDrilling(pages, components, seeds);
  const allPageIds = pages.map((page) => page.id);

  for (const component of components) {
    component.hasCircularDependency = circularDependenciesByComponentId.has(component.id);
    component.circularDependencyChain = circularDependenciesByComponentId.get(component.id);

    if (isFrameworkFile(component.filePath)) {
      component.usedInPages = [];
      component.usageCount = 0;
      component.isShared = false;
      component.shouldMoveToShared = false;
      component.isUnused = false;
      component.unusedReason = undefined;
      component.hasCircularDependency = false;
      component.circularDependencyChain = undefined;
      component.hasPropDrilling = false;
      component.propDrillingDetails = undefined;
      continue;
    }

    const isReserved = isFrameworkReservedFile(component.filePath);
    const usedByPages = isReserved ? allPageIds : Array.from(usageByComponentId.get(component.id) ?? []);
    const usageCount = usedByPages.length;
    const shouldMoveToShared = usageCount >= 2 && !isSharedPath(component.filePath);
    const isReferencedAsJsx = renderReachableComponentIds.has(component.id);
    const isReferencedAsIdentifier = identifierUsageByComponentId.has(component.id);
    const isReferencedThroughBarrel = barrelUsageByComponentId.has(component.id);
    const isUnused =
      !component.hasCircularDependency &&
      !isReferencedAsJsx &&
      !isReferencedAsIdentifier &&
      !isReferencedThroughBarrel &&
      !isReserved;

    component.usedInPages = usedByPages;
    component.usageCount = usageCount;
    component.isShared = usageCount >= 2;
    component.shouldMoveToShared = shouldMoveToShared;
    component.isUnused = isUnused;
    component.unusedReason = isUnused ? "Not referenced by any page or component tree" : undefined;
    component.hasPropDrilling = propDrillingByComponentId.has(component.id);
    component.propDrillingDetails = propDrillingByComponentId.get(component.id);
  }

  const dedupedSeeds = dedupeBy(
    seeds,
    (edge) =>
      `${edge.source}:${edge.target}:${edge.relationshipType}:${edge.props?.map((prop) => `${prop.name}:${prop.type}`).join("|") ?? ""}`
  );

  return dedupedSeeds.map((edge, index) => createEdge(edge, index));
}
