# @reactgraph-ui/core

Core analyzer for ReactGraph - parses your React/Next.js
project and maps Pages -> Components -> Hooks -> APIs.

## Install

```bash
npm install @reactgraph-ui/core
```

## CLI Usage

Run directly without installing:

```bash
npx @reactgraph-ui/core analyze ./src
```

Or if your source is at the root:

```bash
npx @reactgraph-ui/core analyze .
```

Output example:

```text
ReactGraph analysis complete
Pages:      8
Components: 24
Hooks:      6
APIs:       11
Edges:      43
Output written to reactgraph.json
```

## Quick Start: Install from npm

Use this when you want to add ReactGraph to a project as
a normal dependency.

### Step 1 - Install the package

```bash
npm install @reactgraph-ui/core
```

### Step 2 - Create an analysis script

Create `analyze.mjs` in your project root:

```js
import { analyze } from '@reactgraph-ui/core'

const graph = await analyze('.')

console.log('Pages found:     ', graph.pages.length)
console.log('Components found:', graph.components.length)
console.log('Hooks found:     ', graph.hooks.length)
console.log('APIs found:      ', graph.apis.length)
console.log('Edges found:     ', graph.edges.length)
```

### Step 3 - Run it

```bash
node analyze.mjs
```

You can also run the CLI directly without a script:

```bash
npx reactgraph analyze .
```

This gives you the analyzer and CLI only. It does not
include the visual UI by itself.

## Quick Start: Visual Graph from Your Terminal

If you want to view the interactive graph without VS Code,
you can run the local viewer directly from any project.

### Step 1 - Install the package

```bash
npm install @reactgraph-ui/core
```

### Step 2 - Open the visual graph

Open the browser automatically:

```bash
npx reactgraph view .
```

Or start the server without auto-opening:

```bash
npx reactgraph serve .
```

### Step 3 - View in browser

If you used `serve`, open:

```text
http://127.0.0.1:4174
```

This means you do not need VS Code or the monorepo to
view the graph. It works from any project directory.

## Programmatic API

Create a file called `analyze.mjs` in your project root:

```js
import { analyze } from '@reactgraph-ui/core'

const graph = await analyze('.')

console.log('Pages:     ', graph.pages.length)
console.log('Components:', graph.components.length)
console.log('Hooks:     ', graph.hooks.length)
console.log('APIs:      ', graph.apis.length)

// See all pages
graph.pages.forEach(p => {
  console.log(p.name, '->', p.filePath)
})

// See components with props
graph.components
  .filter(c => c.props.length > 0)
  .forEach(c => {
    console.log(c.name)
    c.props.forEach(p => {
      console.log(' ', p.name, ':', p.type, p.required ? '✓' : '?')
    })
  })
```

Run it:

```bash
node analyze.mjs
```

## What the graph object looks like

```ts
interface GraphData {
  pages: PageNode[]
  components: ComponentNode[]
  hooks: HookNode[]
  apis: ApiNode[]
  edges: Edge[]
}
```

Example component node:

```ts
{
  id: 'component:components/ui/Button',
  name: 'Button',
  filePath: 'components/ui/Button.tsx',
  type: 'component',
  props: [
    { name: 'label', type: 'string', required: true },
    { name: 'onClick', type: 'Function', required: true },
    { name: 'disabled', type: 'boolean', required: false }
  ],
  isShared: true,
  usedInPages: ['page:app/dashboard/page', 'page:app/products/page']
}
```

## Works with

- Next.js App Router
- Next.js Pages Router
- Create React App
- Vite + React
- Any TypeScript React project

## VS Code Extension

For a visual interactive graph inside VS Code, install the
ReactGraph extension:

[ReactGraph on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)

## Links

- [GitHub](https://github.com/robinnayak/reactgraph)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=reactgraph.reactgraph-vscode)
- [Report an Issue](https://github.com/robinnayak/reactgraph/issues)

## License

MIT
