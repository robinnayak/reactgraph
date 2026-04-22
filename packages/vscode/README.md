# ReactGraph for VS Code

ReactGraph brings a visual codebase explorer to VS Code for React and Next.js projects.

It analyzes your project and maps:

`Pages -> Components -> Hooks -> APIs`

inside an interactive webview.

## What The Extension Can Do

The VS Code extension can:

- open an interactive graph for your current workspace
- inspect pages, components, hooks, APIs, and relationships
- show props, params, return values, file paths, and usage information
- run impact analysis to show what may be affected by a change
- run a TypeScript health check and summarize issues
- highlight shared components, move-to-shared suggestions, and unused components
- export the current graph as SVG
- copy the workspace file tree to the clipboard
- open a selected file directly in VS Code from the inspector
- keep the graph refreshed when files are saved

## How To Use

1. Open a React or Next.js project in VS Code.
2. Press `Ctrl+Shift+P`.
3. Run:

```txt
ReactGraph: Open Graph
```

The graph opens in a side panel beside your editor.

## Main Features

### Interactive Graph

The graph viewer includes:

- zoom in, zoom out, and fit view controls
- filters for components, hooks, APIs, and context
- node cards with labels, file paths, and visual emphasis
- node selection and focused inspection

### Node Inspector

Selecting a node shows:

- file path
- dependencies
- reverse usage
- props, params, and return data where available
- code context preview
- shared usage suggestions
- unused component warnings

For files in the workspace, the extension can open the selected file directly in the editor.

### Impact Analysis

Impact Analysis helps answer:

- which pages depend on this component
- which downstream nodes may be affected
- which pages appear safe from the selected change

This is useful before refactors and shared-component edits.

### Health Check

The Health Check runs a workspace-level TypeScript-oriented analysis and reports:

- error and warning counts
- affected files
- display issues grouped for easier review
- page-level impact summary

This feature is available in the VS Code extension because it relies on the extension host workflow.

### Copy File Tree

The toolbar includes a `Copy File Tree` action that copies a clean text view of the workspace structure.

The generated tree:

- excludes noisy folders such as `node_modules`, `.git`, `.next`, `dist`, and `build`
- keeps folders before files
- sorts alphabetically
- is formatted for easy sharing in docs, issues, or prompts

### Export SVG

You can export the current graph canvas as an SVG snapshot directly from the toolbar.

## Supported Projects

ReactGraph works best with:

- Next.js App Router projects
- Next.js Pages Router projects
- React TypeScript projects

It is designed around codebase relationships rather than runtime framework internals.

## Build And Install From This Repo

From the monorepo root:

```bash
npm install
npm run build -- --force
cd packages/vscode
npm run package
```

Then in VS Code:

1. Open the Command Palette.
2. Run `Extensions: Install from VSIX...`
3. Select the generated `.vsix` file in `packages/vscode`

## When To Use The Extension Instead Of The CLI

Use the VS Code extension when you want:

- the full interactive graph inside the editor
- health check support
- open-in-editor actions
- workspace-native navigation

Use the core package and CLI when you want:

- terminal analysis
- scripts and automation
- the browser viewer outside VS Code

## Links

- [GitHub Repository](https://github.com/robinnayak/reactgraph)
- [Core Package](https://npmjs.com/package/@reactgraph-ui/core)
- [Issues](https://github.com/robinnayak/reactgraph/issues)

## License

MIT
