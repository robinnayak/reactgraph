import { useDeferredValue, useMemo, useState } from "react";
import type { ReactFlowInstance } from "reactflow";
import GraphCanvas from "./components/GraphCanvas";
import NodeInspector from "./components/NodeInspector";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Toolbar from "./components/Toolbar";
import { useGraphData } from "./hooks/useGraphData";
import { useSearch } from "./hooks/useSearch";
import type { FilterState, GraphNodeRecord } from "./types";

const initialFilters: FilterState = {
  components: true,
  hooks: true,
  apis: true,
  context: true
};

function buildContextNodes(graph: ReturnType<typeof useGraphData>["data"]): GraphNodeRecord[] {
  const contextIds = new Set(graph.edges.filter((edge) => edge.relationshipType === "provides").map((edge) => edge.target));
  return Array.from(contextIds).map((id) => ({
    id,
    name: id.split(":")[1] ?? "Context",
    filePath: "context/provider.tsx",
    type: "context" as const,
    properties: []
  }));
}

function isValidGraphData(value: unknown): value is ReturnType<typeof useGraphData>["data"] {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["pages", "components", "hooks", "apis", "edges"].every((key) => Array.isArray(candidate[key]));
}

export default function App() {
  const { data, loading, error } = useGraphData();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [impactMode, setImpactMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const hasInjectedGraphData = isValidGraphData(window.__REACTGRAPH_DATA__);

  if (!hasInjectedGraphData) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0d1117",
          color: "#8b949e",
          fontFamily: "Inter, system-ui, sans-serif",
          gap: "16px"
        }}
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#30363d" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <h2 style={{ color: "#e6edf3", margin: 0, fontSize: "18px" }}>No graph data found</h2>
        <p style={{ margin: 0, fontSize: "14px", textAlign: "center", maxWidth: "320px" }}>
          Open the command palette in VS Code and run
          <br />
          <code style={{ color: "#79c0ff" }}>ReactGraph: Open Graph</code>
          <br />
          to analyze your project.
        </p>
      </div>
    );
  }

  const allNodes = useMemo<GraphNodeRecord[]>(
    () => [...data.pages, ...data.components, ...data.hooks, ...data.apis, ...buildContextNodes(data)],
    [data]
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const searchedNodes = useSearch(allNodes, deferredQuery);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const dependencies = useMemo(
    () =>
      selectedNode
        ? data.edges
            .filter((edge) => edge.source === selectedNode.id)
            .map((edge) => nodeMap.get(edge.target))
            .filter((node): node is GraphNodeRecord => Boolean(node))
        : [],
    [data.edges, nodeMap, selectedNode]
  );
  const usedIn = useMemo(
    () =>
      selectedNode
        ? data.edges
            .filter((edge) => edge.target === selectedNode.id)
            .map((edge) => nodeMap.get(edge.source))
            .filter((node): node is GraphNodeRecord => Boolean(node))
        : [],
    [data.edges, nodeMap, selectedNode]
  );

  const filteredPages = data.pages.filter((page) => searchedNodes.some((node) => node.id === page.id));

  const openInIde = (filePath: string) => {
    if ("acquireVsCodeApi" in window) {
      window.parent.postMessage({ type: "openFile", filePath }, "*");
      return;
    }
    window.location.href = `vscode://file/${filePath}`;
  };

  return (
    <div className="app-shell">
      <Sidebar
        nodes={searchedNodes}
        onSearchChange={setSearchQuery}
        onSelectPage={(pageId) => {
          setSelectedPageId(pageId);
          setSelectedNodeId(pageId);
        }}
        pages={filteredPages.length > 0 ? filteredPages : data.pages}
        searchQuery={searchQuery}
        selectedPageId={selectedPageId}
      />

      <main className="workspace">
        <Toolbar
          filters={filters}
          flow={flow}
          impactMode={impactMode}
          onToggleFilter={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
          onToggleImpact={() => setImpactMode((current) => !current)}
        />

        {loading ? <div className="state-panel">Loading graph data...</div> : null}
        {error ? <div className="state-panel state-panel--error">{error}</div> : null}

        <GraphCanvas
          filters={filters}
          graph={data}
          impactMode={impactMode}
          onFlowReady={setFlow}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          selectedPageId={selectedPageId ?? data.pages[0]?.id ?? null}
        />

        <StatusBar
          edgeCount={data.edges.length}
          nodes={allNodes}
          selectedName={selectedNode?.name}
          visibleCount={searchedNodes.length}
        />
      </main>

      <NodeInspector
        dependencies={dependencies}
        edges={data.edges}
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onJumpToNode={setSelectedNodeId}
        onOpenInIde={openInIde}
        usedIn={usedIn}
      />
    </div>
  );
}
