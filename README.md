# ReactGraph

Visualize your React/Next.js project as an interactive hierarchy graph.
Maps Pages → Components → Hooks → APIs with props, types, and connections.

## Install (VS Code Extension)

1. Download the `.vsix` file from releases
2. In VS Code: Extensions → ⋯ → Install from VSIX
3. Open any React/Next.js project
4. Cmd+Shift+P → "ReactGraph: Open Graph"

## Install (CLI / npm)

```bash
npx @reactgraph/core analyze ./src
```

## Programmatic API

```ts
import { analyze } from '@reactgraph/core'

const graph = await analyze('./my-project')
console.log(graph.pages)   // all detected pages
console.log(graph.edges)   // all relationships
```

## Development

```bash
npm install
npm run build
npm test
```

## Architecture

- `packages/core` — AST parser, zero UI dependencies, publishable to npm
- `packages/ui` — React + React Flow graph viewer, bundled into the extension
- `packages/vscode` — VS Code extension, hosts the UI in a Webview

No backend. No database. Runs entirely inside VS Code using your local codebase.
