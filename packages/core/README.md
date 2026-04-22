# @reactgraph-ui/core

`@reactgraph-ui/core` is the analyzer, CLI, and packaged browser-viewer runtime behind ReactGraph.

It is the part of the project you install when you want to:

- analyze a React or Next.js project from code
- use the `reactgraph` CLI
- open the local browser viewer with `serve` or `view`
- generate a formatted file tree programmatically

## What This Package Can Do

This package can:

- analyze a project and build graph data for pages, components, hooks, APIs, and edges
- write `reactgraph.json` for downstream consumption
- provide the `reactgraph` CLI
- launch or serve the local browser viewer
- generate a clean project file tree with `generateFileTree()`
- expose TypeScript types for graph data

This package does not include:

- the VS Code extension host
- extension-only features such as open-in-editor commands
- the VS Code health-check workflow

## Install

```bash
npm install @reactgraph-ui/core
```

## CLI Usage

After installing, use the `reactgraph` binary:

```bash
npx reactgraph analyze .
npx reactgraph serve .
npx reactgraph view .
```

Available commands:

- `reactgraph analyze [path]`
  analyze a project and write `reactgraph.json`
- `reactgraph serve [path]`
  start the browser viewer server
- `reactgraph view [path]`
  start the browser viewer and open it automatically when possible

Example:

```bash
npx reactgraph analyze .
npx reactgraph serve .
```

Default browser viewer URL:

```txt
http://127.0.0.1:4174
```

## Programmatic Usage

### Analyze a Project

```ts
import { analyze } from "@reactgraph-ui/core";

const graph = await analyze(".");

console.log(graph.pages.length);
console.log(graph.components.length);
console.log(graph.hooks.length);
console.log(graph.apis.length);
console.log(graph.edges.length);
```

### Generate a File Tree

```ts
import { generateFileTree } from "@reactgraph-ui/core";

const tree = await generateFileTree(".");
console.log(tree);
```

The generated file tree:

- excludes folders such as `node_modules`, `.git`, `.next`, `.turbo`, `.cache`, `dist`, `build`, `.vercel`, and `coverage`
- excludes `*.vsix` and `*.tgz`
- keeps folders before files
- sorts alphabetically
- limits recursion depth

## Graph Data

The main output shape is:

```ts
interface GraphData {
  pages: PageNode[];
  components: ComponentNode[];
  hooks: HookNode[];
  apis: ApiNode[];
  edges: Edge[];
}
```

Graph data can include:

- component props
- hook params and return values
- API endpoints and methods
- component usage counts
- shared-component indicators
- move-to-shared suggestions
- unused-component indicators

## Browser Viewer

This package also powers the browser viewer.

You can use:

```bash
npx reactgraph serve .
```

or:

```bash
npx reactgraph view .
```

The browser viewer includes:

- interactive graph navigation
- impact analysis
- export SVG
- copy file tree

The viewer serves:

- `/reactgraph.json`
- `/file-tree`

## Output Files

When using `analyze()`, the package writes `reactgraph.json` to the target project root.

Add this to your app's `.gitignore`:

```gitignore
reactgraph.json
```

## Local Development And Linking

To test this package in another local project without publishing:

From this package directory:

```powershell
cd "C:\Users\robin\OneDrive\Desktop\React graph\packages\core"
npm run build
npm link
```

From the target project:

```powershell
cd "C:\path\to\your\project"
npm link @reactgraph-ui/core
```

Then run:

```powershell
npx reactgraph analyze .
npx reactgraph serve .
```

If you change only `packages/core/src`, rebuilding this package is usually enough:

```powershell
npm run build
```

If you change UI behavior that affects the browser viewer, rebuild from the monorepo root so viewer assets are recopied:

```powershell
cd "C:\Users\robin\OneDrive\Desktop\React graph"
npm run build -- --force
```

## Works Best With

- Next.js App Router
- Next.js Pages Router
- React TypeScript projects

## Related Packages

- root repo: [ReactGraph](https://github.com/robinnayak/reactgraph)
- VS Code extension docs: `packages/vscode/README.md`

## License

MIT
