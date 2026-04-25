import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { ReactFlowInstance } from "reactflow";
import GraphCanvas from "./components/GraphCanvas";
import ImpactSummaryPanel from "./components/ImpactSummaryPanel";
import NodeInspector from "./components/NodeInspector";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import Toolbar from "./components/Toolbar";
import { useImpactAnalysis } from "./hooks/useImpactAnalysis";
import { useGraphData } from "./hooks/useGraphData";
import { useSearch } from "./hooks/useSearch";
import type {
  FilterState,
  GraphData,
  GraphNodeRecord,
  HealthDisplayIssue,
  HealthCheckResults,
  HealthIssue
} from "./types";

declare global {
  interface Window {
    __REACTGRAPH_HEALTH__?: HealthCheckResults | null;
    vscodeApi?: {
      postMessage: (message: unknown) => void;
    };
  }
}

const initialFilters: FilterState = {
  components: true,
  hooks: true,
  apis: true,
  context: true
};

const emptyGraph: GraphData = {
  projectType: "react",
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

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function postToExtension(message: unknown): void {
  window.vscodeApi?.postMessage(message);
}

async function requestBrowserFileTree(): Promise<string> {
  const response = await fetch("/file-tree");
  if (!response.ok) {
    throw new Error(`Failed to fetch file tree: ${response.status}`);
  }

  return response.text();
}

async function copyTextWithFallback(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
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
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
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

function categorizeIssue(
  issue: Pick<HealthIssue, "filePath"> | Pick<HealthDisplayIssue, "filePaths">,
  node: GraphNodeRecord | undefined
): "page" | "component" | "hook" | "api" {
  if (node && node.type !== "context") {
    return node.type;
  }

  const primaryPath = "filePath" in issue ? issue.filePath : issue.filePaths[0] ?? "";
  const filePath = normalizePath(primaryPath).toLowerCase();
  if (filePath.includes("/app/") || filePath.endsWith("/page.tsx") || filePath.endsWith("/page.ts")) {
    return "page";
  }
  if (filePath.includes("/hooks/") || filePath.includes("use")) {
    return "hook";
  }
  if (filePath.includes("/components/")) {
    return "component";
  }
  return "api";
}

export default function App() {
  const { data, loading, error } = useGraphData();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [impactMode, setImpactMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
  const [healthResults, setHealthResults] = useState<HealthCheckResults | null>(window.__REACTGRAPH_HEALTH__ ?? null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [fileTreeText, setFileTreeText] = useState("");
  const [fileTreeButtonLabel, setFileTreeButtonLabel] = useState("Copy File Tree");
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const canRunHealthCheck = Boolean(window.vscodeApi);
  const canCopyFileTree = canRunHealthCheck || typeof window.fetch === "function";

  const graph = data ?? emptyGraph;
  const allNodes = useMemo<GraphNodeRecord[]>(
    () => [...graph.pages, ...graph.components, ...graph.hooks, ...graph.apis, ...buildContextNodes(graph)],
    [graph]
  );
  const deferredQuery = useDeferredValue(searchQuery);
  const searchedNodes = useSearch(allNodes, deferredQuery);
  const nodeMap = useMemo(() => new Map(allNodes.map((node) => [node.id, node])), [allNodes]);
  const filePathMap = useMemo(() => {
    const map = new Map<string, GraphNodeRecord[]>();
    for (const node of allNodes) {
      if (!("filePath" in node)) {
        continue;
      }
      const key = normalizePath(node.filePath);
      const existing = map.get(key) ?? [];
      existing.push(node);
      map.set(key, existing);
    }
    return map;
  }, [allNodes]);
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) ?? null : null;
  const impact = useImpactAnalysis(impactMode ? selectedNodeId : null, graph.edges);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data;
      if (!message || typeof message !== "object") {
        return;
      }

      if (message.type === "healthCheckStarted") {
        setHealthLoading(true);
        setHealthError(null);
        return;
      }

      if (message.type === "healthCheckCancelled") {
        setHealthLoading(false);
        setHealthError("Health check cancelled.");
        return;
      }

      if (message.type === "healthCheckError" && typeof message.error === "string") {
        setHealthLoading(false);
        setHealthError(message.error);
        return;
      }

      if (message.type === "healthCheckResult" && message.results) {
        setHealthLoading(false);
        setHealthError(null);
        setHealthResults(message.results as HealthCheckResults);
        return;
      }

      if (message.type === "fileTreeResult" && typeof message.tree === "string") {
        setFileTreeText(message.tree);
        return;
      }

      if (message.type === "fileTreeError") {
        setFileTreeError("Copy failed — try again");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImpactMode(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!fileTreeText) {
      return;
    }

    let timeoutId: number | undefined;

    const copyFileTree = async () => {
      try {
        await copyTextWithFallback(fileTreeText);
        setFileTreeError(null);
        setFileTreeButtonLabel("Copied!");
        timeoutId = window.setTimeout(() => setFileTreeButtonLabel("Copy File Tree"), 2000);
      } catch {
        setFileTreeError("Copy failed — try again");
        setFileTreeButtonLabel("Copy File Tree");
      }
    };

    void copyFileTree();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fileTreeText]);

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

  const healthIssuesByNodeId = useMemo(() => {
    const map = new Map<string, HealthIssue[]>();
    for (const issue of healthResults?.issues ?? []) {
      const matches = filePathMap.get(normalizePath(issue.filePath)) ?? [];
      for (const node of matches) {
        const existing = map.get(node.id) ?? [];
        existing.push(issue);
        map.set(node.id, existing);
      }
    }
    return map;
  }, [filePathMap, healthResults?.issues]);

  const healthSections = useMemo(() => {
    const sections = {
      page: [] as HealthDisplayIssue[],
      component: [] as HealthDisplayIssue[],
      hook: [] as HealthDisplayIssue[],
      api: [] as HealthDisplayIssue[]
    };

    for (const issue of healthResults?.displayIssues ?? []) {
      const matchedNode = filePathMap.get(normalizePath(issue.filePaths[0] ?? ""))?.[0];
      sections[categorizeIssue(issue, matchedNode)].push(issue);
    }

    return sections;
  }, [filePathMap, healthResults?.displayIssues]);

  const healthPageStats = useMemo(() => {
    const affectedPageIds = new Set<string>();
    for (const issue of healthResults?.issues ?? []) {
      const matches = filePathMap.get(normalizePath(issue.filePath)) ?? [];
      for (const node of matches) {
        if (node.type === "page") {
          affectedPageIds.add(node.id);
        }
      }
    }

    return {
      affectedPages: affectedPageIds.size,
      cleanPages: Math.max(0, graph.pages.length - affectedPageIds.size)
    };
  }, [filePathMap, graph.pages.length, healthResults?.issues]);

  const impactSummary = useMemo(() => {
    if (!impactMode || !selectedNode) {
      return null;
    }

    const impactedNodes = [...impact.affected, ...impact.indirect]
      .map((id) => nodeMap.get(id))
      .filter((node): node is GraphNodeRecord => Boolean(node));
    const impactedPages = impactedNodes.filter((node) => node.type === "page");
    const impactedPageIds = new Set(impactedPages.map((page) => page.id));
    if (selectedNode.type === "page") {
      impactedPageIds.add(selectedNode.id);
    }

    return {
      selectedNode,
      affectedPages: impactedNodes.filter((node) => node.type === "page"),
      affectedComponents: impactedNodes.filter((node) => node.type === "component"),
      affectedHooks: impactedNodes.filter((node) => node.type === "hook"),
      safePages: graph.pages.filter((page) => !impactedPageIds.has(page.id)),
      directCount: impact.affected.length,
      indirectCount: impact.indirect.length
    };
  }, [graph.pages, impact.affected, impact.indirect, impactMode, nodeMap, selectedNode]);

  const openInIde = (filePath: string) => {
    postToExtension({ type: "openFile", filePath });
  };

  const handlePageSelect = (pageId: string) => {
    setSelectedPageId(pageId);
    setSelectedNodeId(pageId);
  };

  const handleNodeFocus = (nodeId: string) => {
    setSelectedPageId(null);
    setFocusNodeId(nodeId);
  };

  const handleJumpToNode = (nodeId: string) => {
    handleNodeFocus(nodeId);
    setSelectedNodeId(nodeId);
  };

  const handleRunHealthCheck = () => {
    setHealthError(null);
    postToExtension({ type: "startHealthCheck" });
  };

  const handleCancelHealthCheck = () => {
    postToExtension({ type: "cancelHealthCheck" });
  };

  const handleClearHealthCheck = () => {
    setHealthLoading(false);
    setHealthError(null);
    setHealthResults(null);
    postToExtension({ type: "clearHealthCheck" });
  };

  const handleCopyFileTree = () => {
    setFileTreeText("");
    setFileTreeError(null);

    if (window.vscodeApi) {
      postToExtension({ type: "generateFileTree" });
      return;
    }

    void requestBrowserFileTree()
      .then((tree) => setFileTreeText(tree))
      .catch(() => setFileTreeError("Copy failed - try again"));
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
        healthNodes={allNodes}
        nodes={searchedNodes}
        onNodeFocus={handleNodeFocus}
        onNodeSelect={(nodeId) => setSelectedNodeId(nodeId)}
        onSearchChange={setSearchQuery}
        onSelectPage={handlePageSelect}
        pages={filteredPages.length > 0 ? filteredPages : graph.pages}
        searchQuery={searchQuery}
        selectedNodeId={selectedNodeId}
        selectedPageId={selectedPageId}
      />

      <main className="workspace">
        <Toolbar
          canCopyFileTree={canCopyFileTree}
          canRunHealthCheck={canRunHealthCheck}
          fileTreeButtonLabel={fileTreeButtonLabel}
          fileTreeError={fileTreeError}
          filters={filters}
          flow={flow}
          healthHasResults={Boolean(healthResults)}
          healthLoading={healthLoading}
          impactMode={impactMode}
          onCancelHealthCheck={handleCancelHealthCheck}
          onClearHealthCheck={handleClearHealthCheck}
          onCopyFileTree={handleCopyFileTree}
          onRunHealthCheck={handleRunHealthCheck}
          onToggleFilter={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
          onToggleImpact={() =>
            setImpactMode((current) => {
              if (!current) {
                setSelectedNodeId(null);
              }
              return !current;
            })
          }
        />

        {error ? <div className="state-panel state-panel--error">{error}</div> : null}
        {healthError ? <div className="state-panel state-panel--warning">{healthError}</div> : null}

        <GraphCanvas
          focusNodeId={focusNodeId}
          filters={filters}
          graph={graph}
          healthIssuesByNodeId={healthIssuesByNodeId}
          impactMode={impactMode}
          onFocusComplete={() => setFocusNodeId(null)}
          impactResult={impact}
          onFlowReady={setFlow}
          onSelectNode={setSelectedNodeId}
          selectedNodeId={selectedNodeId}
          selectedPageId={selectedPageId ?? graph.pages[0]?.id ?? null}
          summaryPanel={
            <ImpactSummaryPanel
              healthResults={healthResults}
              healthPageStats={healthPageStats}
              healthSections={healthSections}
              impactSummary={impactSummary}
              onClearHealth={handleClearHealthCheck}
            />
          }
        />

        <StatusBar
          edgeCount={graph.edges.length}
          healthResults={healthResults}
          nodes={allNodes}
          projectType={graph.projectType}
          selectedName={selectedNode?.name}
          visibleCount={searchedNodes.length}
        />
      </main>

      <NodeInspector
        allNodes={allNodes}
        dependencies={dependencies}
        edges={graph.edges}
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onPageSelect={handlePageSelect}
        onJumpToNode={handleJumpToNode}
        onOpenInIde={openInIde}
        usedIn={usedIn}
      />
    </div>
  );
}
