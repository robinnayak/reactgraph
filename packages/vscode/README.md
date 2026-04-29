# ReactGraph for VS Code

ReactGraph visualizes React, Next.js, and Expo codebases inside VS Code so you can understand how pages, components, hooks, APIs, and context connect before you refactor.

Version: `0.1.6`  
Publisher: Robin Nayak  
Marketplace: [reactgraph.reactgraph-vscode](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)

## How To Use

1. Open your React, Next.js, or Expo project in VS Code.
2. Run `ReactGraph: Open Graph Viewer` from the Command Palette.
3. Explore your codebase visually.

## Features

- Interactive graph with zoom, pan, and minimap
- Node inspector with props table, return values, dependencies, and code snippet
- Page switcher sidebar for moving between app routes and screens
- Search bar and filter toggles for Components, Hooks, APIs, and Context
- Impact Analysis that highlights the blast radius of a selected node
- Health Check that runs `tsc --noEmit` and maps errors onto graph nodes
- Export SVG for sharing a graph snapshot
- Copy File Tree for docs, issues, and reviews
- Clickable sidebar items that center the graph and open the inspector
- Expo and React Native support, including Expo Router and `screens/`
- Runs entirely locally with no backend and no database

## Code Health Badges

ReactGraph highlights common structure and maintenance signals:

- `SHARED` (gold): used by 2+ pages and already inside `shared/`
- `MOVE TO SHARED` (orange): used by 2+ pages and outside `shared/`
- `UNUSED` (red): no importers found
- `CIRCULAR` (purple): participates in an import cycle
- `PROP DRILL` (amber): prop passed through 3+ levels unchanged

The Code Health sidebar groups these findings, and each item can be clicked to center the graph and open the inspector.

## Requirements

- VS Code `1.80+`
- Node.js available in your workspace environment
- A React, Next.js, Expo, or React Native project
- TypeScript project recommended for the best inspector and Health Check results

## Supported Projects

ReactGraph currently works best with Next.js folder conventions, especially App Router `app/**/page.tsx` and Pages Router `pages/**/*.tsx` projects. Expo Router and React Native screens are supported, with deeper framework-specific detection planned as the analyzer grows.

- Next.js App Router: `app/`
- Next.js Pages Router: `pages/`
- Expo Router: `app/`
- React Native: `screens/`

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

## Issues And Contributions

ReactGraph is open source. Report issues, request features, or contribute at:

[https://github.com/robinnayak/reactgraph](https://github.com/robinnayak/reactgraph)

## License

MIT
