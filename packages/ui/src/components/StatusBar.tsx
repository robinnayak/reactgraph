import type { GraphNodeRecord, HealthCheckResults } from "../types";

interface StatusBarProps {
  nodes: GraphNodeRecord[];
  visibleCount: number;
  edgeCount: number;
  selectedName?: string;
  healthResults: HealthCheckResults | null;
}

export default function StatusBar({ nodes, visibleCount, edgeCount, selectedName, healthResults }: StatusBarProps) {
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
    unused: componentNodes.filter((node) => node.isUnused).length
  };

  return (
    <footer className="statusbar">
      <span>{counts.pages} pages</span>
      <span>{counts.components} components</span>
      <span>{counts.hooks} hooks</span>
      <span>{counts.apis} APIs</span>
      <span>{counts.context} context</span>
      {counts.shouldMoveToShared > 0 ? <span>{counts.shouldMoveToShared} should move to shared</span> : null}
      {counts.unused > 0 ? <span>{counts.unused} unused</span> : null}
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
