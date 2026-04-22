# ReactGraph

Visualize your React or Next.js project as an interactive hierarchy graph.
ReactGraph maps Pages -> Components -> Hooks -> APIs with props, types, and relationships.

## What ReactGraph includes

This monorepo has three parts:

- `@robinnayak/reactgraph-core`: the analyzer library and CLI
- `packages/ui`: the browser UI built with React and React Flow
- `packages/vscode`: the VS Code extension that bundles the analyzer and UI into a webview

This distinction matters:

- `@robinnayak/reactgraph-core` gives you graph data
- the browser viewer and VS Code extension give you the visual UI

## Quick Start: VS Code Extension

This is the easiest way to use ReactGraph.

1. Build and package the extension:

```bash
npm run build -- --force
cd packages/vscode
npm run package
```

2. Open VS Code.

3. Press `Ctrl+Shift+P` to open the Command Palette.

4. Run:

```txt
Extensions: Install from VSIX...
```

5. In the file picker, locate the generated VSIX in the ReactGraph repo:

```txt
packages/vscode/reactgraph-vscode-0.1.0.vsix
```

Select that file and install it.

6. Open your React or Next.js project in VS Code.

7. Press `Ctrl+Shift+P` again and run:

```txt
ReactGraph: Open Graph
```

The graph opens in a side panel inside VS Code.

## Quick Start: CLI

Use this when you want analysis output in the terminal from your current project directory.

Install the package directly from npm in your project:

```bash
npm install @robinnayak/reactgraph-core
```

Then run the analyzer with the installed CLI binary:

```bash
npx reactgraph analyze .
```

Or programmatically:

```js
import { analyze } from "@robinnayak/reactgraph-core";

const graph = await analyze(".");
console.log(graph.pages.length);
console.log(graph.components.length);
console.log(graph.hooks.length);
console.log(graph.apis.length);
console.log(graph.edges.length);
```

This mode is analysis only. It does not open the UI by itself.

The analyzer writes `reactgraph.json` to your project root, so add this to your app's `.gitignore`:

```gitignore
reactgraph.json
```

## Quick Start: Install From npm

Use this when you want to add ReactGraph to a project as a normal dependency instead of using `npm link`.

1. Install the package:

```bash
npm install @robinnayak/reactgraph-core
```

2. Create a small script such as `analyze.mjs` in your project root:

```js
import { analyze } from "@robinnayak/reactgraph-core";

const graph = await analyze(".");

console.log("Pages found:", graph.pages.length);
console.log("Components found:", graph.components.length);
console.log("Hooks found:", graph.hooks.length);
console.log("APIs found:", graph.apis.length);
console.log("Edges found:", graph.edges.length);
```

3. Run it:

```bash
node analyze.mjs
```

You can also use the installed package directly from your current project terminal without writing a script:

```bash
npx reactgraph analyze .
```

This gives you the analyzer and CLI only. It does not include the visual UI by itself.

## Quick Start: Visual Graph From Your Current Project Terminal

If you install `@robinnayak/reactgraph-core`, you can also view the graph outside VS Code directly from the project you want to analyze.

1. Install the package in your project:

```bash
npm install @robinnayak/reactgraph-core
```

2. From that same project directory, either open the browser automatically:

```bash
npx reactgraph view .
```

Or start the local viewer server without auto-opening the browser:

```bash
npx reactgraph serve .
```

3. If you use `serve`, open:

```txt
http://127.0.0.1:4174
```

This means users do not need to navigate back to the ReactGraph monorepo just to see the UI.

## Quick Start: Test Locally Without Publishing to npm

Use this when you want to test the npm package locally without uploading anything to npm.

### Step 1 - Link the package globally from the ReactGraph monorepo

```powershell
cd C:\Users\robin\OneDrive\Desktop\React graph\packages\core
npm run build
npm link
```

### Step 2 - Link it into your other project

```powershell
cd C:\path\to\your\ecommerce-project
npm link @robinnayak/reactgraph-core
```

### Step 3 - Create a small analysis script

```js
import { analyze } from "@robinnayak/reactgraph-core";

const graph = await analyze(".");

console.log("Pages found:", graph.pages.length);
console.log("Components found:", graph.components.length);
console.log("Hooks found:", graph.hooks.length);
console.log("APIs found:", graph.apis.length);
console.log("Edges found:", graph.edges.length);
```

### Step 4 - Run it

```bash
node analyze.mjs
```

You can also use the linked CLI directly from that project:

```bash
npx reactgraph analyze .
npx reactgraph serve .
npx reactgraph view .
```

This uses the package exactly like a published npm install, but everything stays local on your machine.

## Quick Start: Local Browser Viewer

Use this when you want the ReactGraph UI in your browser without installing the VS Code extension and without installing the npm package into another project.

1. Build the repo from the monorepo root:

```bash
npm install
npm run build -- --force
```

2. Start the local viewer for your target project:

```bash
npm run view -- "C:\path\to\your\project"
```

Example:

```bash
npm run view -- "C:\Users\robin\OneDrive\Desktop\ecommerse"
```

3. Open the printed local URL in your browser:

```txt
http://127.0.0.1:4174
```

This command:

- analyzes the target project with `@robinnayak/reactgraph-core`
- serves the built UI from `packages/ui/dist`
- exposes the graph data at `/reactgraph.json`

## Why the command to run is `reactgraph`, not `@robinnayak/reactgraph-core`

`@robinnayak/reactgraph-core` is the npm package name.
`reactgraph` is the CLI binary name it installs into your project.

So after `npm install @robinnayak/reactgraph-core` or `npm link @robinnayak/reactgraph-core`, use:

```bash
npx reactgraph analyze .
npx reactgraph serve .
npx reactgraph view .
```

## Why the local monorepo browser viewer still exists

`npm link @robinnayak/reactgraph-core` links the analyzer package and CLI into another project.

That package exports:

- the `analyze()` API
- the CLI command
- graph data types

It does not include:

- the browser UI host
- the VS Code webview host
- automatic rendering in a browser window

So this is expected:

- `npm link @robinnayak/reactgraph-core` works for scripts, terminal analysis, and the installed `reactgraph` CLI
- the `.vsix` shows the full UI inside VS Code
- `npm run view -- "<project>"` shows the UI in your browser from the monorepo

## Testing locally without publishing to npm

If you want to test the analyzer package inside another project before publishing:

1. Link the package globally:

```bash
cd packages/core
npm run build
npm link
```

2. Link it into your other project:

```bash
cd C:\path\to\your\project
npm link @robinnayak/reactgraph-core
```

3. Create a small script such as `analyze.mjs`:

```js
import { analyze } from "@robinnayak/reactgraph-core";

const graph = await analyze(".");

console.log("Pages found:", graph.pages.length);
console.log("Components found:", graph.components.length);
console.log("Hooks found:", graph.hooks.length);
console.log("APIs found:", graph.apis.length);
console.log("Edges found:", graph.edges.length);
```

4. Run it:

```bash
node analyze.mjs
```

If you also want the visual UI while testing locally, run the browser viewer from the ReactGraph repo root:

```bash
npm run build -- --force
npm run view -- "C:\path\to\your\project"
```

When finished, unlink with:

```bash
npm unlink @robinnayak/reactgraph-core
```

## Development

Requirements:

- Node.js 18+
- npm 9+

Setup:

```bash
git clone https://github.com/robinnayak/reactgraph.git
cd reactgraph
npm install
npm run build
npm test
```

Project structure:

```txt
reactgraph/
  packages/
    core/     analyzer and CLI
    ui/       browser graph viewer
    vscode/   VS Code extension
  scripts/
    view-graph.mjs
```

Useful commands:

```bash
# Build everything
npm run build -- --force

# Run tests
npm test

# Analyze a project through the built CLI
npm run analyze -- analyze "C:\path\to\project"

# Open the browser viewer for a project
npm run view -- "C:\path\to\project"
```

## Architecture

```txt
Project source files
  -> @robinnayak/reactgraph-core analyzes the codebase
  -> GraphData is produced in memory and optionally written as reactgraph.json
  -> packages/ui renders the graph
  -> packages/vscode hosts that UI inside a VS Code webview
```

- No backend
- No database
- No internet required
- No changes required to the target React app

## FAQ

**Does ReactGraph modify my project files?**
Only the CLI or programmatic analyzer writes `reactgraph.json`. Otherwise ReactGraph reads your files and builds the graph in memory.

**Why are built-in hooks like `useState` not listed as hook nodes?**
ReactGraph currently focuses on project-defined hooks and relationships in your codebase, not every framework hook imported from React or Next.js.

**Can I use this outside VS Code?**
Yes. Either install `@robinnayak/reactgraph-core` in your project and run:

```bash
npx reactgraph view .
```

Or use the monorepo browser viewer with:

```bash
npm run view -- "C:\path\to\project"
```

**Can I use this in automation or CI?**
Yes. Use `analyze()` or the CLI and consume the resulting `GraphData` or `reactgraph.json`.

## License

MIT. See [LICENSE](./LICENSE).
