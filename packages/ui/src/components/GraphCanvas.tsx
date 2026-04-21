import { useEffect, useMemo, useState } from "react";
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
import type { GraphData, GraphNodeRecord, FilterState } from "../types";
import type { BaseNodeData } from "./nodes/shared";
import PageNode from "./nodes/PageNode";
import ComponentNode from "./nodes/ComponentNode";
import HookNode from "./nodes/HookNode";
import ApiNode from "./nodes/ApiNode";
import ContextNode from "./nodes/ContextNode";
import { useImpactAnalysis } from "../hooks/useImpactAnalysis";

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

function getLayoutedNodes(
  nodes: GraphNodeRecord[],
  edges: GraphData["edges"],
  selectedPageId: string | null
): FlowNode<BaseNodeData>[] {
  const levelMap = new Map<string, number>();
  const levelGroups = new Map<number, GraphNodeRecord[]>();
  const componentIdsForPage = new Set(
    edges
      .filter((edge) => edge.relationshipType === "renders" && edge.source === selectedPageId)
      .map((edge) => edge.target)
  );

  for (const node of nodes) {
    let level = 3;
    if (node.type === "page") {
      level = 1;
    } else if (componentIdsForPage.has(node.id)) {
      level = 2;
    } else if (node.type === "api" || node.type === "context") {
      level = 4;
    } else if (node.type === "hook") {
      level = 3;
    }
    levelMap.set(node.id, level);
    levelGroups.set(level, [...(levelGroups.get(level) ?? []), node]);
  }

  return nodes.map((node) => {
    const level = levelMap.get(node.id) ?? 3;
    const group = levelGroups.get(level) ?? [node];
    const index = group.findIndex((entry) => entry.id === node.id);
    const spacing = 240;
    const width = (group.length - 1) * spacing;
    const x = 540 - width / 2 + index * spacing;
    const yMap: Record<number, number> = { 1: 80, 2: 240, 3: 400, 4: 560 };

    const fields =
      node.type === "component"
        ? node.props.map((prop) => ({ name: prop.name, type: prop.type, required: prop.required }))
        : node.type === "hook"
          ? node.params.map((param) => ({ name: param.name, type: param.type }))
          : node.type === "context"
            ? node.properties
            : [];

    return {
      id: node.id,
      type: node.type,
      position: { x, y: yMap[level] ?? 400 },
      data: {
        label: node.type === "api" ? node.endpoint : node.name,
        filePath: node.filePath,
        kindLabel: node.type.toUpperCase(),
        color: colors[node.type],
        borderStyle: node.type === "context" ? "dashed" : "solid",
        isShared: node.type === "component" ? node.isShared : false,
        fields
      }
    };
  });
}

function edgeStyleFor(source: GraphNodeRecord | undefined, target: GraphNodeRecord | undefined): Partial<FlowEdge> {
  if (!source || !target) {
    return {};
  }
  if (source.type === "page" && target.type === "component") {
    return { style: { stroke: "#2563eb", strokeWidth: 3.5 } };
  }
  if (source.type === "component" && target.type === "component") {
    return { style: { stroke: "#16a34a", strokeWidth: 3 } };
  }
  if (source.type === "component" && target.type === "hook") {
    return { style: { stroke: "#16a34a", strokeWidth: 3 } };
  }
  if (source.type === "hook" && target.type === "api") {
    return { style: { stroke: "#ea580c", strokeWidth: 2.5 } };
  }
  if (target.type === "context" || source.type === "context") {
    return { style: { stroke: "#7c3aed", strokeWidth: 2.5, strokeDasharray: "6 4" } };
  }
  return { style: { stroke: "#8b949e", strokeWidth: 2 } };
}

function InnerGraphCanvas(props: {
  graph: GraphData;
  selectedPageId: string | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  filters: FilterState;
  impactMode: boolean;
  onFlowReady: (flow: ReactFlowInstance) => void;
}) {
  const { graph, selectedPageId, selectedNodeId, onSelectNode, filters, impactMode, onFlowReady } = props;
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
  const impact = useImpactAnalysis(impactMode ? selectedNodeId : null, graph.edges);

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
        if (selectedPageId && node.type === "page" && node.id !== selectedPageId) {
          return false;
        }
        return true;
      }),
    [filters.apis, filters.components, filters.context, filters.hooks, nodeRecords, selectedPageId]
  );

  const visibleIds = new Set(filteredRecords.map((node) => node.id));
  const flowNodes = useMemo(() => {
    const nodes = getLayoutedNodes(filteredRecords, graph.edges, selectedPageId);
    return nodes.map((node) => {
      const isFocused = selectedNodeId === node.id;
      const isAffected = impact.affected.includes(node.id) || impact.indirect.includes(node.id);
      return {
        ...node,
        style: {
          opacity:
            impactMode && selectedNodeId
              ? isFocused || isAffected || node.id === selectedNodeId
                ? 1
                : 0.28
              : 1
        }
      };
    });
  }, [filteredRecords, graph.edges, impact.affected, impact.indirect, impactMode, selectedNodeId, selectedPageId]);

  const flowEdges = useMemo<FlowEdge[]>(
    () =>
      graph.edges
        .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
        .map((edge) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          const style = edgeStyleFor(source, target);
          const propSummary = edge.props?.map((prop) => `${prop.name}: ${prop.type}`).join(", ") ?? "None";
          return {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: "smoothstep",
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: style.style?.stroke as string | undefined
            },
            ...style,
            data: {
              tooltip: `${edge.relationshipType} | Props: ${propSummary}`
            }
          };
        }),
    [graph.edges, nodeMap, visibleIds]
  );

  return (
    <div className="graph-shell">
      <ReactFlow
        edges={flowEdges}
        fitView
        maxZoom={2}
        minZoom={0.4}
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
  onSelectNode: (nodeId: string | null) => void;
  filters: FilterState;
  impactMode: boolean;
  onFlowReady: (flow: ReactFlowInstance) => void;
}) {
  return (
    <ReactFlowProvider>
      <InnerGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
