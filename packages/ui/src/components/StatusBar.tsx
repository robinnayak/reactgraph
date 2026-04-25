import type { GraphData, GraphNodeRecord, HealthCheckResults } from "../types";

interface StatusBarProps {
  nodes: GraphNodeRecord[];
  visibleCount: number;
  edgeCount: number;
  selectedName?: string;
  healthResults: HealthCheckResults | null;
  projectType: GraphData["projectType"];
}

const projectTypeColors: Record<GraphData["projectType"], string> = {
  nextjs: "#2563eb",
  expo: "#7c3aed",
  react: "#06b6d4"
};

const projectTypeLabels: Record<GraphData["projectType"], string> = {
  nextjs: "Next.js",
  expo: "Expo",
  react: "React"
};

export default function StatusBar({
  nodes,
  visibleCount,
  edgeCount,
  selectedName,
  healthResults,
  projectType
}: StatusBarProps) {
  const componentNodes = nodes.filter(
    (node): node is Extract<GraphNodeRecord, { type: "component" }> => node.type === "component"
  );
  const counts = {
    pages: nodes.filter((node) => node.type === "page").length,
    components: componentNodes.length,
    hooks: nodes.filter((node) => node.type === "hook").length,
    apis: nodes.filter((node) => node.type === "api").length,
    context: nodes.filter((node) => node.type === "context").length,
    shouldMoveToShared: componentNodes.filter((node) => node.shouldMoveToShared).length,
    unused: componentNodes.filter((node) => node.isUnused).length,
    circularDeps: componentNodes.filter((node) => node.hasCircularDependency).length,
    propDrilling: componentNodes.filter((node) => node.hasPropDrilling).length
  };

  return (
    <footer className="statusbar">
      <span>{counts.pages} pages</span>
      <span>{counts.components} components</span>
      <span>{counts.hooks} hooks</span>
      <span>{counts.apis} APIs</span>
      <span>|</span>
      <span>
        Project: <strong style={{ color: projectTypeColors[projectType] }}>{projectTypeLabels[projectType]}</strong>
      </span>
      {counts.pages === 0 ? <span>⚠️ No pages detected — open Settings to configure page detection patterns</span> : null}
      <span>{counts.context} context</span>
      {counts.shouldMoveToShared > 0 ? <span>{counts.shouldMoveToShared} should move to shared</span> : null}
      {counts.unused > 0 ? <span>{counts.unused} unused</span> : null}
      {counts.circularDeps > 0 ? <span>{counts.circularDeps} circular deps</span> : null}
      {counts.propDrilling > 0 ? <span>{counts.propDrilling} prop drilling</span> : null}
      <span>{visibleCount} visible nodes</span>
      <span>{edgeCount} visible edges</span>
      <span>
        {healthResults
          ? healthResults.clean
            ? "Health: clean"
            : `Health: ${healthResults.errorCount} errors, ${healthResults.warningCount} warnings`
          : "Health: not run"}
      </span>
      <span>{selectedName ? `Selected: ${selectedName}` : "Select a node to inspect"}</span>
    </footer>
  );
}
