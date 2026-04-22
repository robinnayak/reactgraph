# ReactGraph

ReactGraph helps you understand a React or Next.js codebase as a graph.
It analyzes your project and maps:

`Pages -> Components -> Hooks -> APIs`

You can use it in three ways:

- as a CLI and programmatic analyzer with `@reactgraph-ui/core`
- as a local browser viewer
- as a VS Code extension

## What ReactGraph Can Do

ReactGraph can:

- detect pages in Next.js App Router and Pages Router projects
- discover components, custom hooks, and API calls
- build relationships between pages, components, hooks, and APIs
- show which components are shared across multiple pages
- flag components that likely belong in `components/shared`
- flag components that appear unused
- inspect props, params, return types, and file paths
- visualize the graph interactively with zoom, pan, and fit view
- run impact analysis to show what changes may affect
- run a TypeScript-focused health check in the VS Code extension
- copy a formatted project file tree from the graph UI
- open files from the VS Code extension webview

## Package Overview

This monorepo contains:

- `packages/core`
  `@reactgraph-ui/core`, the analyzer library, CLI, and packaged browser viewer assets
- `packages/ui`
  the React webview and browser UI
- `packages/vscode`
  the VS Code extension that hosts the UI inside a webview

## Feature Matrix

| Feature | `@reactgraph-ui/core` CLI | Browser viewer | VS Code extension |
| --- | --- | --- | --- |
| Analyze project structure | Yes | Yes | Yes |
| Programmatic API | Yes | No | No |
| Interactive graph UI | No | Yes | Yes |
| `serve` / `view` commands | Yes | Yes | No |
| Impact Analysis | No | Yes | Yes |
| Copy File Tree | No | Yes | Yes |
| Export SVG | No | Yes | Yes |
| Open in IDE | No | No | Yes |
| Health Check | No | No | Yes |

## Quick Start

### Option 1: VS Code Extension

Use this when you want the richest workflow inside VS Code.

1. Build and package the extension:

```bash
npm install
npm run build -- --force
cd packages/vscode
npm run package
```

2. In VS Code, open the Command Palette with `Ctrl+Shift+P`.

3. Run:

```txt
Extensions: Install from VSIX...
```

4. Choose:

```txt
packages/vscode/reactgraph-vscode-0.1.1.vsix
```

5. Open your React or Next.js project in VS Code.

6. Run:

```txt
ReactGraph: Open Graph
```

The extension includes:

- the interactive graph viewer
- node inspection
- impact analysis
- health check
- copy file tree
- export SVG
- open file in editor

### Option 2: CLI in Any Project

Use this when you want analysis output or the browser viewer from a project terminal.

Install the package:

```bash
npm install @reactgraph-ui/core
```

Run analysis:

```bash
npx reactgraph analyze .
```

Start the browser viewer without auto-opening:

```bash
npx reactgraph serve .
```

Or open the browser automatically:

```bash
npx reactgraph view .
```

By default the viewer runs at:

```txt
http://127.0.0.1:4174
```

### Option 3: Monorepo Browser Viewer

Use this when you are developing ReactGraph itself and want to test the browser UI against another local project.

From the repo root:

```bash
npm install
npm run build -- --force
npm run view -- "C:\path\to\your\project"
```

This uses the built analyzer and browser UI from the monorepo and serves the graph locally.

## CLI Commands

After installing or linking `@reactgraph-ui/core`, the command to run is `reactgraph`.

```bash
npx reactgraph analyze .
npx reactgraph serve .
npx reactgraph view .
```

Supported commands:

- `reactgraph analyze [path]`
  analyze the project and write `reactgraph.json`
- `reactgraph serve [path]`
  start the browser viewer server
- `reactgraph view [path]`
  start the browser viewer and try to open it automatically

The browser viewer supports:

- interactive graph navigation
- impact analysis
- export SVG
- copy file tree

## Programmatic API

You can use the analyzer directly in scripts or automation.

```ts
import { analyze, generateFileTree } from "@reactgraph-ui/core";

const graph = await analyze(".");
const tree = await generateFileTree(".");

console.log(graph.pages.length);
console.log(tree);
```

Common exports:

- `analyze(projectRoot)`
- `generateFileTree(projectRoot)`
- graph-related TypeScript types such as `GraphData`

## File Tree Export

ReactGraph can generate a clean text representation of the project structure.

It:

- excludes common noise such as `node_modules`, `.git`, `.next`, `dist`, `build`, and archive artifacts
- keeps folders before files
- sorts alphabetically within each group
- limits recursion depth to keep output readable

Example:

```txt
my-app/
├── app/
│   ├── dashboard/
│   │   └── page.tsx
│   ├── products/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── shared/
│   │   └── AdminShell.tsx
│   └── ui/
│       └── Button.tsx
├── package.json
└── tsconfig.json
```

Where it works:

- browser viewer
- VS Code extension
- programmatic API with `generateFileTree()`

## Local Testing Without Publishing to npm

Use this when you want another local project to consume your in-progress `packages/core` package.

### Link the local package

From the ReactGraph repo:

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

### Run the linked CLI

```powershell
npx reactgraph analyze .
npx reactgraph serve .
npx reactgraph view .
```

### When You Need to Rebuild

If you changed only analyzer logic in `packages/core/src`, rebuild `packages/core`:

```powershell
cd "C:\Users\robin\OneDrive\Desktop\React graph\packages\core"
npm run build
```

If you changed the UI or anything that affects the browser viewer or VS Code webview, rebuild from the repo root:

```powershell
cd "C:\Users\robin\OneDrive\Desktop\React graph"
npm run build -- --force
```

In most cases you do not need to unlink and link again after every change. Rebuilding is enough as long as the symlink is still active.

## Output and Project Files

The analyzer writes `reactgraph.json` to the target project root when using `analyze()`.

Add this to your app's `.gitignore`:

```gitignore
reactgraph.json
```

The browser viewer serves graph data at:

```txt
/reactgraph.json
```

It also exposes:

```txt
/file-tree
```

for browser-based file tree copying.

## Development

Requirements:

- Node.js 18+
- npm 9+

Setup:

```bash
git clone https://github.com/robinnayak/reactgraph.git
cd reactgraph
npm install
npm run build -- --force
npm test
```

Useful commands:

```bash
# Build all packages
npm run build -- --force

# Run tests
npm test

# Analyze a target project through the built CLI
npm run analyze -- analyze "C:\path\to\project"

# Open the monorepo browser viewer for a target project
npm run view -- "C:\path\to\project"
```

Project structure:

```txt
reactgraph/
├── packages/
│   ├── core/
│   ├── ui/
│   └── vscode/
└── scripts/
    └── view-graph.mjs
```

## Architecture

At a high level:

```txt
Project source files
  -> @reactgraph-ui/core analyzes the codebase
  -> GraphData is created in memory
  -> analyze() can write reactgraph.json
  -> the browser viewer or VS Code extension renders the graph
```

ReactGraph:

- does not require a backend
- does not require a database
- does not require internet access
- does not modify app source files beyond generating `reactgraph.json`

## FAQ

### Does ReactGraph only work with Next.js?

No. It works best with React and Next.js TypeScript codebases, including:

- Next.js App Router
- Next.js Pages Router
- Vite + React
- other TypeScript React projects

### Why are built-in React hooks not shown as hook nodes?

ReactGraph focuses on project-defined hooks and relationships in your codebase, not every framework hook import.

### Why does the browser viewer sometimes need a full repo rebuild?

Because the packaged viewer assets are copied from `packages/ui/dist` into `packages/core/dist/viewer`. If the UI changed, the built viewer needs to be regenerated.

### What is the difference between `serve` and `view`?

- `serve` starts the local viewer and prints the URL
- `view` starts the local viewer and also tries to open your browser automatically

### What is the difference between the package name and the CLI name?

- npm package: `@reactgraph-ui/core`
- CLI command: `reactgraph`

So after install or link, run:

```bash
npx reactgraph analyze .
```

## License

MIT. See [LICENSE](./LICENSE).
