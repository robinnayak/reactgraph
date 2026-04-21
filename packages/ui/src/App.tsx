import { useDeferredValue, useMemo, useState } from "react";
import type { ReactFlowInstance } from "reactflow";
import GraphCanvas from "./components/GraphCanvas";
import NodeInspector from "./components/NodeInspector";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Toolbar from "./components/Toolbar";
import { useGraphData } from "./hooks/useGraphData";
import { useSearch } from "./hooks/useSearch";
import type { FilterState, GraphData, GraphNodeRecord } from "./types";

const initialFilters: FilterState = {
  components: true,
  hooks: true,
  apis: true,
  context: true
};

const emptyGraph: GraphData = {
  pages: [],
  components: [],
  hooks: [],
  apis: [],
  edges: []
};

function buildContextNodes(graph: GraphData): GraphNodeRecord[] {
  const contextIds = new Set(graph.edges.filter((edge) => edge.relationshipType === "provides").map((edge) => edge.target));
  return Array.from(contextIds).map((id) => ({
    id,
    name: id.split(":")[1] ?? "Context",
    filePath: "context/provider.tsx",
    type: "context" as const,
    properties: []
  }));
}

function EmptyState(props: { message: string; helper: string }) {
  const { message, helper } = props;

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
      <h2 style={{ color: "#e6edf3", margin: 0, fontSize: "18px" }}>{message}</h2>
      <p style={{ margin: 0, fontSize: "14px", textAlign: "center", maxWidth: "420px" }}>{helper}</p>
    </div>
  );
}

export default function App() {
  const { data, loading, error } = useGraphData();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [impactMode, setImpactMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

  const graph = data ?? emptyGraph;
  const allNodes = useMemo<GraphNodeRecord[]>(
    () => [...graph.pages, ...graph.components, ...graph.hooks, ...graph.apis, ...buildContextNodes(graph)],
    [graph]
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const searchedNodes = useSearch(allNodes, deferredQuery);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const dependencies = useMemo(
    () =>
      selectedNode
        ? graph.edges
            .filter((edge) => edge.source === selectedNode.id)
            .map((edge) => nodeMap.get(edge.target))
            .filter((node): node is GraphNodeRecord => Boolean(node))
        : [],
    [graph.edges, nodeMap, selectedNode]
  );
  const usedIn = useMemo(
    () =>
      selectedNode
        ? graph.edges
            .filter((edge) => edge.target === selectedNode.id)
            .map((edge) => nodeMap.get(edge.source))
            .filter((node): node is GraphNodeRecord => Boolean(node))
        : [],
    [graph.edges, nodeMap, selectedNode]
  );
  const filteredPages = graph.pages.filter((page) => searchedNodes.some((node) => node.id === page.id));

  const openInIde = (filePath: string) => {
    if ("acquireVsCodeApi" in window) {
      window.parent.postMessage({ type: "openFile", filePath }, "*");
      return;
    }
    window.location.href = `vscode://file/${filePath}`;
  };

  if (loading) {
    return <EmptyState helper="ReactGraph is loading your project graph." message="Loading graph data..." />;
  }

  if (!data) {
    return (
      <EmptyState
        helper={
          error ??
          "No graph data was found. In VS Code use ReactGraph: Open Graph, or in browser mode start the local viewer with npm run view -- \"<project>\"."
        }
        message="No graph data found"
      />
    );
  }

  return (
    <div className="app-shell">
      <Sidebar
        nodes={searchedNodes}
        onSearchChange={setSearchQuery}
        onSelectPage={(pageId) => {
          setSelectedPageId(pageId);
          setSelectedNodeId(pageId);
        }}
        pages={filteredPages.length > 0 ? filteredPages : graph.pages}
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

        {error ? <div className="state-panel state-panel--error">{error}</div> : null}

        <GraphCanvas
          filters={filters}
          graph={graph}
          impactMode={impactMode}
          onFlowReady={setFlow}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          selectedPageId={selectedPageId ?? graph.pages[0]?.id ?? null}
        />

        <StatusBar
          edgeCount={graph.edges.length}
          nodes={allNodes}
          selectedName={selectedNode?.name}
          visibleCount={searchedNodes.length}
        />
      </main>

      <NodeInspector
        dependencies={dependencies}
        edges={graph.edges}
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onJumpToNode={setSelectedNodeId}
        onOpenInIde={openInIde}
        usedIn={usedIn}
      />
    </div>
  );
}
