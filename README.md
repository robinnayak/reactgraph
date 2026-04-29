# ReactGraph

Open-source developer tool for visualizing React, Next.js, and Expo codebases as an interactive `Pages -> Components -> Hooks -> APIs` graph.

[![npm version](https://img.shields.io/npm/v/@reactgraph-ui/core)](https://www.npmjs.com/package/@reactgraph-ui/core)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![VS Code installs](https://img.shields.io/visual-studio-marketplace/i/reactgraph.reactgraph-vscode)](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)

Version: `0.1.6`  
Publisher: Robin Nayak

## What It Does

ReactGraph analyzes your project locally and turns source relationships into a navigable graph:

```txt
Pages -> Components -> Hooks -> APIs
```

It helps developers inspect dependencies, spot shared or unused components, understand refactor impact, and map TypeScript health issues back to the files they affect.

<!-- screenshot -->

ReactGraph runs entirely locally. It does not require a backend, database, or hosted service.

## Features

- Interactive graph with zoom, pan, and minimap
- Node inspector with props table, returns, dependencies, and code snippet
- Page switcher sidebar
- Search bar and filter toggles for Components, Hooks, APIs, and Context
- Impact Analysis with blast radius highlighting
- Health Check that runs `tsc --noEmit` and maps errors onto graph nodes
- Export SVG
- Copy File Tree
- Code Health badges and sidebar sections:
  - `SHARED` (gold): used by 2+ pages and inside `shared/`
  - `MOVE TO SHARED` (orange): used by 2+ pages and outside `shared/`
  - `UNUSED` (red): no importers found
  - `CIRCULAR` (purple): participates in an import cycle
  - `PROP DRILL` (amber): prop passed through 3+ levels unchanged
- Clickable sidebar items that center the graph and open the inspector
- Expo and React Native support, including Expo Router and `screens/`
- No backend, no database, and no external runtime service

## Monorepo Structure

```txt
packages/core   AST parser and CLI package (@reactgraph-ui/core)
packages/ui     React and React Flow graph viewer
packages/vscode VS Code extension
```

## Getting Started

### Via npm and CLI

Install the core package:

```bash
npm install @reactgraph-ui/core
```

Analyze a project:

```bash
npx reactgraph analyze <project-path>
```

Start the local graph viewer:

```bash
npx reactgraph serve <project-path>
```

The analyzer writes `reactgraph.json` with pages, components, hooks, APIs, edges, and code health metadata.

### Via VS Code Extension

Install ReactGraph from the Marketplace:

[https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)

Then:

1. Open your React, Next.js, or Expo project in VS Code.
2. Run `ReactGraph: Open Graph Viewer`.
3. Explore the graph, inspect nodes, run Health Check, and export what you need.

## Supported Projects

ReactGraph currently works best with Next.js folder conventions, especially App Router `app/**/page.tsx` and Pages Router `pages/**/*.tsx` projects. Expo Router and React Native screens are supported, with deeper framework-specific detection planned as the analyzer grows.

- Next.js App Router: `app/`
- Next.js Pages Router: `pages/`
- Expo Router: `app/`
- React Native: `screens/`

## Tech Stack

- Parser: `@typescript-eslint/typescript-estree`
- Graph UI: React Flow
- Code highlighting: Shiki
- Build: Turborepo
- Testing: Vitest
- Extension bundler: esbuild

## Build Commands

```bash
npm run build --force
npm test
cd packages/vscode && npm run package
```

## Changelog

### v0.1.2

- Fixed component files misclassified as pages, including `AdminShell`, `*PageView`, and similar files.
- Fixed `layout.tsx` and framework files receiving code health badges.
- Fixed circular dependency participants also being marked unused.
- Fixed duplicate prop drill entries per component.

## Known Limitations

Planned for v0.2:

- Service layer API detection, such as `goalsApi.getGoals()` patterns
- React Query and SWR wrapper detection
- Code health export as a markdown report
- Real-time graph updates on file save

## Contributing

Contributions are welcome.

1. Fork [robinnayak/reactgraph](https://github.com/robinnayak/reactgraph).
2. Create a focused branch for your fix or feature.
3. Run the build and tests.
4. Open a pull request with a clear description and screenshots when UI behavior changes.

Useful links:

- npm: [@reactgraph-ui/core](https://www.npmjs.com/package/@reactgraph-ui/core)
- VS Code Marketplace: [reactgraph.reactgraph-vscode](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)
- GitHub: [robinnayak/reactgraph](https://github.com/robinnayak/reactgraph)

## License

MIT
