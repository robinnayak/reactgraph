import type { GraphNodeRecord, HealthCheckResults } from "../types";

interface StatusBarProps {
  nodes: GraphNodeRecord[];
  visibleCount: number;
  edgeCount: number;
  selectedName?: string;
  healthResults: HealthCheckResults | null;
}

export default function StatusBar({ nodes, visibleCount, edgeCount, selectedName, healthResults }: StatusBarProps) {
  const counts = {
    pages: nodes.filter((node) => node.type === "page").length,
    components: nodes.filter((node) => node.type === "component").length,
    hooks: nodes.filter((node) => node.type === "hook").length,
    apis: nodes.filter((node) => node.type === "api").length,
    context: nodes.filter((node) => node.type === "context").length
  };

  return (
    <footer className="statusbar">
      <span>{counts.pages} pages</span>
      <span>{counts.components} components</span>
      <span>{counts.hooks} hooks</span>
      <span>{counts.apis} APIs</span>
      <span>{counts.context} context</span>
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
