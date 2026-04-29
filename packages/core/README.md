# @reactgraph-ui/core

`@reactgraph-ui/core` is the local analyzer and CLI for ReactGraph, an open-source tool that maps React, Next.js, and Expo projects as `Pages -> Components -> Hooks -> APIs`.

Version: `0.1.6`  
Publisher: Robin Nayak

## Install

```bash
npm install @reactgraph-ui/core
```

Package: [@reactgraph-ui/core on npm](https://www.npmjs.com/package/@reactgraph-ui/core)

## CLI Usage

Analyze a project and write `reactgraph.json`:

```bash
npx reactgraph analyze <project-path>
```

Start the local browser viewer:

```bash
npx reactgraph serve <project-path>
```

The viewer runs locally and does not require a backend or database.

## Output

`reactgraph analyze` produces graph data with:

- `pages`: detected route and screen entry points
- `components`: React components, props, usage counts, and health metadata
- `hooks`: custom hooks with params and return values
- `apis`: detected API calls and HTTP methods
- `edges`: relationships between pages, components, hooks, APIs, and context
- Code health: shared components, move-to-shared suggestions, unused nodes, circular dependencies, and prop drilling

The analyzer writes `reactgraph.json` to the target project root.

## Supported Project Structures

ReactGraph currently works best with Next.js folder conventions, especially App Router `app/**/page.tsx` and Pages Router `pages/**/*.tsx` projects. Expo Router and React Native screens are supported, with deeper framework-specific detection planned as the analyzer grows.

- Next.js App Router: `app/`
- Next.js Pages Router: `pages/`
- Expo Router: `app/`
- React Native: `screens/`

## Features

- Interactive graph with zoom, pan, and minimap
- Node inspector with props table, returns, dependencies, and code snippet
- Page switcher sidebar
- Search bar and filter toggles for Components, Hooks, APIs, and Context
- Impact Analysis with blast radius highlighting
- Health Check support for `tsc --noEmit` results in graph nodes
- Export SVG
- Copy File Tree
- Code Health badges and sidebar sections:
  - `SHARED` (gold): used by 2+ pages and inside `shared/`
  - `MOVE TO SHARED` (orange): used by 2+ pages and outside `shared/`
  - `UNUSED` (red): no importers found
  - `CIRCULAR` (purple): participates in an import cycle
  - `PROP DRILL` (amber): prop passed through 3+ levels unchanged
- Clickable sidebar items that center the graph and open the inspector
- Expo and React Native support
- Runs entirely locally with no backend and no database

## Programmatic Usage

```ts
import { analyze, generateFileTree } from "@reactgraph-ui/core";

const graph = await analyze(".");
const tree = await generateFileTree(".");

console.log(graph.pages.length);
console.log(graph.components.length);
console.log(tree);
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

## Full Documentation

See the GitHub repository for full docs, source code, issues, and contribution notes:

[https://github.com/robinnayak/reactgraph](https://github.com/robinnayak/reactgraph)

## License

MIT
