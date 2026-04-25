import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/types";
import type { Param, ParsedModule, Prop, ReturnValue } from "../types.js";

export const PAGE_GLOBS = ["pages/**/*.tsx", "app/**/page.tsx"];
export const TS_GLOBS = ["**/*.ts", "**/*.tsx"];
export const JSX_GLOBS = ["**/*.tsx"];
export const DEFAULT_IGNORES = [
  "**/node_modules/**",
  "**/.next/**",
  "**/.expo/**",
  "**/dist/**",
  "**/build/**",
  "**/android/**",
  "**/ios/**",
  "**/coverage/**",
  "**/.turbo/**"
];

const ROUTE_LIKE_SEGMENTS = new Set(["pages", "screens", "app", "views", "routes"]);
const NON_ROUTE_SEGMENTS = new Set([
  "components",
  "hooks",
  "lib",
  "utils",
  "types",
  "styles",
  "config",
  "store",
  "stores",
  "services",
  "assets"
]);
const REACT_NATIVE_HOOK_INDICATORS = new Set([
  "useWindowDimensions",
  "useColorScheme",
  "useNavigation",
  "useRoute",
  "useFocusEffect"
]);
const RESERVED_ROUTE_FILES = new Set([
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
  "middleware.tsx",
  "route.ts",
  "route.tsx",
  "_layout.tsx",
  "_layout.ts",
  "+not-found.tsx",
  "+html.tsx"
]);

export function resolveProjectFiles(projectRoot: string, patterns: string[]): string[] {
  return (patterns ?? []).flatMap((pattern) =>
    globSync(pattern, {
      cwd: projectRoot,
      absolute: true,
      nodir: true,
      ignore: DEFAULT_IGNORES
    })
  );
}

export function parseModule(filePath: string): ParsedModule {
  const source = fs.readFileSync(filePath, "utf8");
  const ast = parse(source, {
    loc: true,
    range: true,
    comment: false,
    jsx: filePath.endsWith(".tsx"),
    sourceType: "module"
  });
  const imports = new Map<string, string>();
  const exports = new Set<string>();
  let defaultExportName: string | undefined;

  for (const statement of ast.body) {
    if (statement.type === "ImportDeclaration") {
      for (const specifier of statement.specifiers) {
        if (
          specifier.type === "ImportSpecifier" ||
          specifier.type === "ImportDefaultSpecifier" ||
          specifier.type === "ImportNamespaceSpecifier"
        ) {
          imports.set(specifier.local.name, statement.source.value);
        }
      }
    }

    if (statement.type === "ExportNamedDeclaration") {
      if (statement.declaration) {
        collectDeclaredNames(statement.declaration).forEach((name) => exports.add(name));
      }
      for (const specifier of statement.specifiers) {
        exports.add(specifier.exported.type === "Identifier" ? specifier.exported.name : specifier.exported.value);
      }
    }

    if (statement.type === "ExportDefaultDeclaration") {
      const declaration = statement.declaration;
      if (declaration.type === "Identifier") {
        defaultExportName = declaration.name;
      } else if ("id" in declaration && declaration.id?.type === "Identifier") {
        defaultExportName = declaration.id.name;
        exports.add(declaration.id.name);
      } else {
        defaultExportName = inferAnonymousExportName(filePath);
      }
    }
  }

  return { filePath, source, ast, imports, exports, defaultExportName };
}

export function collectDeclaredNames(node: TSESTree.Node): string[] {
  if ("id" in node && node.id?.type === "Identifier") {
    return [node.id.name];
  }
  if (node.type === "VariableDeclaration") {
    return (node.declarations ?? []).flatMap((declaration) =>
      declaration.id.type === "Identifier" ? [declaration.id.name] : []
    );
  }
  return [];
}

export function inferAnonymousExportName(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(tsx?|jsx?)$/, "");
  if (base === "page") {
    return path.basename(path.dirname(filePath)) || "Page";
  }
  if (base === "_layout") {
    return path.basename(path.dirname(filePath)) || "Layout";
  }
  if (base === "index") {
    return path.basename(path.dirname(filePath)) || "Index";
  }
  if (base.startsWith("+")) {
    return base.slice(1) || "Route";
  }
  return base;
}

export function createNodeId(kind: string, value: string): string {
  return `${kind}:${normalizeId(value)}`;
}

export function normalizeId(value: string): string {
  return value.replace(/\\/g, "/").replace(/[^a-zA-Z0-9/_-]+/g, "-").toLowerCase();
}

export function relativeFilePath(projectRoot: string, filePath: string): string {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

export function traverse(node: unknown, visitor: (node: TSESTree.Node, parent?: TSESTree.Node) => void, parent?: TSESTree.Node): void {
  if (!node || typeof node !== "object") {
    return;
  }

  const maybeNode = node as Partial<TSESTree.Node>;
  if (typeof maybeNode.type === "string") {
    visitor(maybeNode as TSESTree.Node, parent);
    for (const value of Object.values(maybeNode)) {
      if (Array.isArray(value)) {
        value.forEach((entry) => traverse(entry, visitor, maybeNode as TSESTree.Node));
      } else if (value && typeof value === "object") {
        traverse(value, visitor, maybeNode as TSESTree.Node);
      }
    }
  }
}

export function getTypeText(node: TSESTree.TypeNode | null | undefined, source: string): string {
  if (!node || node.range == null) {
    return "unknown";
  }
  return source.slice(node.range[0], node.range[1]).trim() || "unknown";
}

export function expressionText(node: TSESTree.Node | null | undefined, source: string): string | undefined {
  if (!node || node.range == null) {
    return undefined;
  }
  return source.slice(node.range[0], node.range[1]).trim() || undefined;
}

export function inferTypeFromExpression(node: TSESTree.Expression | null | undefined, source: string): string {
  if (!node) {
    return "unknown";
  }

  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") {
        return "string";
      }
      if (typeof node.value === "number") {
        return "number";
      }
      if (typeof node.value === "boolean") {
        return "boolean";
      }
      if (node.value === null) {
        return "null";
      }
      return "unknown";
    case "ArrayExpression":
      return "unknown[]";
    case "ObjectExpression":
      return "object";
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "Function";
    case "TemplateLiteral":
      return "string";
    case "Identifier":
      return node.name;
    default:
      return expressionText(node, source) ?? "unknown";
  }
}

export function extractParams(params: TSESTree.Parameter[], source: string): Param[] {
  return (params ?? []).flatMap((param) => {
    if (param.type === "Identifier") {
      return [
        {
          name: param.name,
          type: getTypeText(param.typeAnnotation?.typeAnnotation, source)
        }
      ];
    }

    if (param.type === "AssignmentPattern" && param.left.type === "Identifier") {
      return [
        {
          name: param.left.name,
          type: getTypeText(param.left.typeAnnotation?.typeAnnotation, source),
          defaultValue: expressionText(param.right, source)
        }
      ];
    }

    if (param.type === "RestElement" && param.argument.type === "Identifier") {
      return [
        {
          name: `...${param.argument.name}`,
          type: getTypeText(param.argument.typeAnnotation?.typeAnnotation, source)
        }
      ];
    }

    return [];
  });
}

export function extractReturns(
  functionNode:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression,
  source: string
): ReturnValue[] {
  const annotated = getTypeText(functionNode.returnType?.typeAnnotation, source);
  if (annotated !== "unknown") {
    return [{ name: "return", type: annotated }];
  }

  const inferred: ReturnValue[] = [];
  traverse(functionNode.body, (node) => {
    if (node.type !== "ReturnStatement" || !node.argument) {
      return;
    }

    if (node.argument.type === "ObjectExpression") {
      for (const property of node.argument.properties) {
        if (property.type === "Property" && property.key.type === "Identifier") {
          inferred.push({
            name: property.key.name,
            type: inferTypeFromExpression(
              property.value.type === "AssignmentPattern" ? property.value.right : (property.value as TSESTree.Expression),
              source
            )
          });
        }
      }
    } else {
      inferred.push({
        name: "return",
        type: inferTypeFromExpression(node.argument, source)
      });
    }
  });

  return dedupeBy(inferred, (value) => `${value.name}:${value.type}`);
}

export function extractPropsFromTypeAliasOrInterface(
  typeNode: TSESTree.TSTypeAliasDeclaration | TSESTree.TSInterfaceDeclaration,
  source: string
): Prop[] {
  const members = getTypeMembers(typeNode.type === "TSTypeAliasDeclaration" ? typeNode.typeAnnotation : typeNode.body);
  return extractPropsFromMembers(members, source);
}

export function getTypeMembers(
  typeNode: TSESTree.TypeNode | TSESTree.TSInterfaceBody | null | undefined
): TSESTree.TypeElement[] {
  if (!typeNode) {
    return [];
  }

  if (typeNode.type === "TSInterfaceBody") {
    return typeNode.body;
  }

  if (typeNode.type === "TSTypeLiteral") {
    return typeNode.members;
  }

  return [];
}

export function extractPropsFromMembers(members: TSESTree.TypeElement[], source: string): Prop[] {
  return (members ?? []).flatMap((member) => {
    if (member.type !== "TSPropertySignature" || member.key.type !== "Identifier") {
      return [];
    }
    return [
      {
        name: member.key.name,
        type: getTypeText(member.typeAnnotation?.typeAnnotation, source),
        required: !member.optional
      }
    ];
  });
}

export function dedupeBy<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const id = key(value);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function resolveImportToFile(fromFile: string, importPath: string): string | undefined {
  if (!importPath.startsWith(".")) {
    return undefined;
  }

  const fromDir = path.dirname(fromFile);
  const candidateBase = path.resolve(fromDir, importPath);
  const candidates = [
    candidateBase,
    `${candidateBase}.ts`,
    `${candidateBase}.tsx`,
    path.join(candidateBase, "index.ts"),
    path.join(candidateBase, "index.tsx")
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

export function isHookName(name: string): boolean {
  return /^use[A-Z0-9_]/.test(name);
}

export function isLikelyComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9_]*$/.test(name);
}

export function isFrameworkReservedFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  const reserved = [...RESERVED_ROUTE_FILES, "App.tsx", "App.ts", "index.tsx", "index.ts"];

  return reserved.some((name) => normalized.endsWith(name) || normalized.endsWith(`/${name}`));
}

export function pathSegments(filePath: string): string[] {
  return relativeSegments(filePath);
}

function relativeSegments(filePath: string): string[] {
  return filePath.replace(/\\/g, "/").split("/").filter(Boolean);
}

export function hasDefaultComponentExport(module: ParsedModule): boolean {
  return (module.ast as TSESTree.Program).body.some((statement) => {
    if (statement.type !== "ExportDefaultDeclaration") {
      return false;
    }

    const declaration = statement.declaration;
    if (
      declaration.type === "FunctionDeclaration" ||
      declaration.type === "FunctionExpression" ||
      declaration.type === "ArrowFunctionExpression"
    ) {
      return looksLikeJsxReturningFunction(declaration);
    }

    if (declaration.type === "Identifier" && module.defaultExportName) {
      let matches = false;
      traverse(module.ast, (node) => {
        if (
          matches ||
          node.type !== "VariableDeclarator" ||
          node.id.type !== "Identifier" ||
          node.id.name !== module.defaultExportName ||
          !node.init ||
          (node.init.type !== "ArrowFunctionExpression" && node.init.type !== "FunctionExpression")
        ) {
          return;
        }

        matches = looksLikeJsxReturningFunction(node.init);
      });
      return matches;
    }

    return false;
  });
}

export function isRouteLikeParentFolder(segment: string | undefined): boolean {
  if (!segment) {
    return false;
  }

  const normalized = segment.toLowerCase();
  return /^[a-z0-9_-]+$/.test(normalized) && !NON_ROUTE_SEGMENTS.has(normalized);
}

export function isPageLikeFile(relativePath: string, module?: ParsedModule): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = relativeSegments(normalized);
  const fileName = path.basename(normalized);
  const baseName = path.basename(normalized, path.extname(normalized));
  const parent = segments.at(-2)?.toLowerCase();
  const hasDefaultExport = module ? hasDefaultComponentExport(module) : false;
  const isInsideAppRouter = /(^|\/)app\//.test(normalized);
  const isInsidePagesRouter = /(^|\/)pages\//.test(normalized);
  const isInsideScreenLikeFolder = /(^|\/)(screens|views|routes)\//.test(normalized);

  if ([...RESERVED_ROUTE_FILES].some((name) => normalized.endsWith(name) || normalized.endsWith(`/${name}`))) {
    return false;
  }

  // Next.js App Router pages must be explicit page.* files.
  if (isInsideAppRouter) {
    return /(^|\/)page\.(tsx|ts|jsx|js)$/.test(normalized);
  }

  if (isInsidePagesRouter) {
    return true;
  }

  if (isInsideScreenLikeFolder || /(?:Page|Screen|View|Route)\.tsx?$/.test(fileName)) {
    return true;
  }

  if (baseName === "page") {
    return true;
  }

  if (hasDefaultExport && isRouteLikeParentFolder(parent)) {
    return true;
  }

  if (hasDefaultExport && parent === "app") {
    return true;
  }

  return false;
}

export function isComponentLikeFile(relativePath: string, module?: ParsedModule): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const fileName = path.basename(normalized);
  const baseName = path.basename(fileName, path.extname(fileName));
  const hasComponentExport = module ? hasReactComponentExport(module) : false;

  if (isPageLikeFile(normalized, module) && !/(^|\/)(app|screens)\//.test(normalized)) {
    return false;
  }

  if (/(^|\/)components\//.test(normalized)) {
    return true;
  }

  if (/(^|\/)(app|screens)\//.test(normalized) && baseName !== "page" && hasComponentExport) {
    return true;
  }

  if (isLikelyComponentName(path.basename(fileName, path.extname(fileName))) && hasComponentExport) {
    return true;
  }

  return hasComponentExport && !segmentsContainRouteLikeFolder(normalized);
}

function segmentsContainRouteLikeFolder(relativePath: string): boolean {
  return relativeSegments(relativePath).some((segment) => ROUTE_LIKE_SEGMENTS.has(segment.toLowerCase()));
}

export function hasReactComponentExport(module: ParsedModule): boolean {
  let found = false;

  traverse(module.ast, (node) => {
    if (found) {
      return;
    }

    if (node.type === "FunctionDeclaration" && node.id && module.exports.has(node.id.name)) {
      found = looksLikeJsxReturningFunction(node);
      return;
    }

    if (
      node.type === "VariableDeclarator" &&
      node.id.type === "Identifier" &&
      node.init &&
      (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression") &&
      (module.exports.has(node.id.name) || module.defaultExportName === node.id.name)
    ) {
      found = looksLikeJsxReturningFunction(node.init);
      return;
    }

    if (
      node.type === "ExportDefaultDeclaration" &&
      (node.declaration.type === "FunctionDeclaration" ||
        node.declaration.type === "FunctionExpression" ||
        node.declaration.type === "ArrowFunctionExpression")
    ) {
      found = looksLikeJsxReturningFunction(node.declaration);
    }
  });

  return found;
}

export function fileUsesReactNativeHookIndicators(module: ParsedModule): boolean {
  let found = false;

  traverse(module.ast, (node) => {
    if (found || node.type !== "Identifier") {
      return;
    }

    if (REACT_NATIVE_HOOK_INDICATORS.has(node.name)) {
      found = true;
    }
  });

  return found;
}

export function looksLikeJsxReturningFunction(
  fn:
    | TSESTree.FunctionDeclaration
    | TSESTree.FunctionExpression
    | TSESTree.ArrowFunctionExpression
): boolean {
  let found = false;
  traverse(fn.body, (node) => {
    if (node.type === "JSXElement" || node.type === "JSXFragment") {
      found = true;
    }
  });
  return found;
}
