import { useEffect, useMemo, useState, type ReactNode } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeTypes,
  type ReactFlowInstance
} from "reactflow";
import type {
  Edge as GraphEdge,
  GraphData,
  GraphNodeRecord,
  FilterState,
  HealthIssue,
  ImpactResult
} from "../types";
import type { BaseNodeData } from "./nodes/shared";
import PageNode from "./nodes/PageNode";
import ComponentNode from "./nodes/ComponentNode";
import HookNode from "./nodes/HookNode";
import ApiNode from "./nodes/ApiNode";
import ContextNode from "./nodes/ContextNode";

const nodeTypes: NodeTypes = {
  page: PageNode,
  component: ComponentNode,
  hook: HookNode,
  api: ApiNode,
  context: ContextNode
};

const colors = {
  page: "#2563eb",
  component: "#16a34a",
  hook: "#ea580c",
  api: "#dc2626",
  context: "#7c3aed"
} as const;

function getNodeLabel(node: GraphNodeRecord): string {
  return node.type === "api" ? node.endpoint : node.name;
}

function getNodeFilePath(node: GraphNodeRecord): string {
  return "filePath" in node ? node.filePath : `${node.method} ${node.endpoint}`;
}

function buildContextNodes(graph: GraphData): GraphNodeRecord[] {
  const ids = new Set(graph.edges.filter((edge) => edge.relationshipType === "provides").map((edge) => edge.target));
  return Array.from(ids).map((id) => ({
    id,
    name: id.split(":")[1]?.replace(/-/g, " ") ?? "Context",
    filePath: "context/provider.tsx",
    type: "context" as const,
    properties: []
  }));
}

function getEdgeColor(type: string): string {
  switch (type) {
    case "renders":
      return "#2563eb";
    case "uses":
      return "#16a34a";
    case "calls":
      return "#ea580c";
    case "provides":
      return "#7c3aed";
    case "navigates":
      return "#06b6d4";
    default:
      return "#30363d";
  }
}

function getLayoutedNodes(
  nodes: GraphNodeRecord[],
  edges: GraphEdge[]
): { id: string; position: { x: number; y: number } }[] {
  void edges;

  const levelMap: Record<string, number> = {
    page: 0,
    component: 1,
    hook: 2,
    api: 3,
    context: 3
  };

  const yPositions = [80, 260, 440, 620];
  const xPadding = 260;
  const levels: Record<number, GraphNodeRecord[]> = { 0: [], 1: [], 2: [], 3: [] };

  nodes.forEach((node) => {
    const level = levelMap[node.type] ?? 1;
    levels[level].push(node);
  });

  const positioned: { id: string; position: { x: number; y: number } }[] = [];

  Object.entries(levels).forEach(([levelStr, levelNodes]) => {
    const level = Number.parseInt(levelStr, 10);
    const y = yPositions[level] ?? 260;
    const totalWidth = Math.max(1, levelNodes.length) * xPadding;
    const startX = Math.max(100, 900 - totalWidth / 2);

    levelNodes.forEach((node, index) => {
      positioned.push({
        id: node.id,
        position: { x: startX + index * xPadding, y }
      });
    });
  });

  return positioned;
}

function InnerGraphCanvas(props: {
  graph: GraphData;
  selectedPageId: string | null;
  selectedNodeId: string | null;
  focusNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onFocusComplete: () => void;
  filters: FilterState;
  impactMode: boolean;
  impactResult: ImpactResult;
  healthIssuesByNodeId: Map<string, HealthIssue[]>;
  onFlowReady: (flow: ReactFlowInstance) => void;
  summaryPanel?: ReactNode;
}) {
  const {
    graph,
    selectedPageId,
    selectedNodeId,
    focusNodeId,
    onSelectNode,
    onFocusComplete,
    filters,
    impactMode,
    impactResult,
    healthIssuesByNodeId,
    onFlowReady,
    summaryPanel
  } = props;
  const reactFlow = useReactFlow();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  useEffect(() => {
    onFlowReady(reactFlow);
  }, [onFlowReady, reactFlow]);

  const contextNodes = useMemo(() => buildContextNodes(graph), [graph]);
  const nodeRecords = useMemo<GraphNodeRecord[]>(
    () => [...graph.pages, ...graph.components, ...graph.hooks, ...graph.apis, ...contextNodes],
    [contextNodes, graph]
  );
  const nodeMap = useMemo(() => new Map(nodeRecords.map((node) => [node.id, node])), [nodeRecords]);

  const allowedBySelectedPage = useMemo(() => {
    if (!selectedPageId || impactMode) {
      return null;
    }

    const ids = new Set<string>([selectedPageId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const edge of graph.edges) {
        if (ids.has(edge.source) && !ids.has(edge.target)) {
          ids.add(edge.target);
          changed = true;
        }
      }
    }

    return ids;
  }, [graph.edges, impactMode, selectedPageId]);

  const filteredRecords = useMemo(
    () =>
      nodeRecords.filter((node) => {
        if (node.type === "component" && !filters.components) {
          return false;
        }
        if (node.type === "hook" && !filters.hooks) {
          return false;
        }
        if (node.type === "api" && !filters.apis) {
          return false;
        }
        if (node.type === "context" && !filters.context) {
          return false;
        }
        if (allowedBySelectedPage && !allowedBySelectedPage.has(node.id)) {
          return false;
        }
        return true;
      }),
    [allowedBySelectedPage, filters.apis, filters.components, filters.context, filters.hooks, nodeRecords]
  );

  const visibleIds = new Set(filteredRecords.map((node) => node.id));
  const directAffectedIds = useMemo(() => new Set(impactResult.affected), [impactResult.affected]);
  const indirectAffectedIds = useMemo(() => new Set(impactResult.indirect), [impactResult.indirect]);
  const activeImpactIds = useMemo(() => {
    const ids = new Set<string>([...impactResult.affected, ...impactResult.indirect]);
    if (selectedNodeId) {
      ids.add(selectedNodeId);
    }
    return ids;
  }, [impactResult.affected, impactResult.indirect, selectedNodeId]);

  const flowNodes = useMemo(() => {
    const layoutPositions = getLayoutedNodes(filteredRecords, graph.edges);

    const allNodes: FlowNode<BaseNodeData>[] = filteredRecords.map((node) => {
      const fields =
        node.type === "component"
          ? node.props.map((prop) => ({ name: prop.name, type: prop.type, required: prop.required }))
          : node.type === "hook"
            ? node.params.map((param) => ({ name: param.name, type: param.type }))
            : node.type === "context"
              ? node.properties
              : [];
      const issues = healthIssuesByNodeId.get(node.id) ?? [];
      const errorCount = issues.filter((issue) => issue.severity === "error").length;
      const warningCount = issues.filter((issue) => issue.severity === "warning").length;

      let emphasis: BaseNodeData["emphasis"] = "normal";
      if (impactMode && selectedNodeId) {
        if (node.id === selectedNodeId) {
          emphasis = "selected";
        } else if (directAffectedIds.has(node.id)) {
          emphasis = "direct";
        } else if (indirectAffectedIds.has(node.id)) {
          emphasis = "indirect";
        } else {
          emphasis = "dimmed";
        }
      }

      const pos = layoutPositions.find((position) => position.id === node.id);
      return {
        id: node.id,
        type: node.type,
        position: pos?.position ?? { x: 100, y: 100 },
        data: {
          label: getNodeLabel(node),
          filePath: getNodeFilePath(node),
          kindLabel: node.type.toUpperCase(),
          color: colors[node.type],
          borderStyle: node.type === "context" ? "dashed" : "solid",
          isShared: node.type === "component" ? node.isShared : false,
          shouldMoveToShared: node.type === "component" ? node.shouldMoveToShared : false,
          isUnused: node.type === "component" ? node.isUnused : false,
          hasCircularDependency: node.type === "component" ? node.hasCircularDependency : false,
          hasPropDrilling: node.type === "component" ? node.hasPropDrilling : false,
          usageCount: node.type === "component" ? node.usageCount : 0,
          fields,
          emphasis,
          issueBadge:
            errorCount > 0 || warningCount > 0
              ? {
                  severity: errorCount > 0 ? "error" : "warning",
                  errorCount,
                  warningCount
                }
              : null
        },
        style: {
          opacity: impactMode && selectedNodeId && emphasis === "dimmed" ? 0.22 : 1
        }
      };
    });

    return allNodes;
  }, [
    directAffectedIds,
    filteredRecords,
    graph.edges,
    healthIssuesByNodeId,
    impactMode,
    indirectAffectedIds,
    selectedNodeId
  ]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    return graph.edges
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge) => {
        const color = getEdgeColor(edge.relationshipType);
        const isConnectedToImpact = activeImpactIds.has(edge.source) || activeImpactIds.has(edge.target);
        const faded = impactMode && selectedNodeId && !isConnectedToImpact;

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          animated: Boolean(impactMode && selectedNodeId && isConnectedToImpact),
          style: {
            stroke: faded ? "rgba(99, 110, 123, 0.28)" : color,
            strokeWidth: faded ? 1.2 : isConnectedToImpact ? 3.4 : 2.5,
            opacity: faded ? 0.22 : 0.95
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: faded ? "rgba(99, 110, 123, 0.35)" : color,
            width: 20,
            height: 20
          },
          label: edge.props?.length
            ? edge.props
                .slice(0, 2)
                .map((prop) => `${prop.name}: ${prop.type}`)
                .join(", ")
            : undefined,
          labelStyle: { fontSize: 10, fill: "#8b949e" },
          labelBgStyle: { fill: "#1c2333" },
          data: {
            tooltip: `${edge.relationshipType} | ${
              nodeMap.get(edge.source) ? getNodeLabel(nodeMap.get(edge.source) as GraphNodeRecord) : edge.source
            } -> ${nodeMap.get(edge.target) ? getNodeLabel(nodeMap.get(edge.target) as GraphNodeRecord) : edge.target}`
          }
        };
      });
  }, [activeImpactIds, graph.edges, impactMode, nodeMap, selectedNodeId, visibleIds]);

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }

    const targetNode = flowNodes.find((node) => node.id === focusNodeId);
    if (!targetNode) {
      return;
    }

    reactFlow.setCenter(
      targetNode.position.x + (targetNode.width ?? 180) / 2,
      targetNode.position.y + (targetNode.height ?? 80) / 2,
      { zoom: 1.2, duration: 600 }
    );
    onFocusComplete();
  }, [focusNodeId, flowNodes, onFocusComplete, reactFlow]);

  return (
    <div className="graph-shell">
      <ReactFlow
        edges={flowEdges}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1.05 }}
        maxZoom={2}
        minZoom={0.3}
        nodeTypes={nodeTypes}
        nodes={flowNodes}
        onEdgeMouseEnter={(_, edge) => {
          setTooltip({
            x: 24,
            y: 120,
            text: String(edge.data?.tooltip ?? "")
          });
        }}
        onEdgeMouseLeave={() => setTooltip(null)}
        onNodeClick={(_, node) => onSelectNode(node.id)}
      >
        <Background color="#31353c" gap={30} size={1.2} />
        <Controls showInteractive={false} />
        <MiniMap pannable style={{ background: "#10141a" }} zoomable />
      </ReactFlow>
      {summaryPanel}
      {tooltip ? (
        <div className="edge-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      ) : null}
    </div>
  );
}

export default function GraphCanvas(props: {
  graph: GraphData;
  selectedPageId: string | null;
  selectedNodeId: string | null;
  focusNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onFocusComplete: () => void;
  filters: FilterState;
  impactMode: boolean;
  impactResult: ImpactResult;
  healthIssuesByNodeId: Map<string, HealthIssue[]>;
  onFlowReady: (flow: ReactFlowInstance) => void;
  summaryPanel?: ReactNode;
}) {
  return (
    <ReactFlowProvider>
      <InnerGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
