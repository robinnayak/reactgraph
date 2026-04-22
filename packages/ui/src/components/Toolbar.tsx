import { FolderTree } from "lucide-react";
import type { ReactFlowInstance } from "reactflow";
import type { FilterState } from "../types";

interface ToolbarProps {
  filters: FilterState;
  onToggleFilter: (key: keyof FilterState) => void;
  impactMode: boolean;
  onToggleImpact: () => void;
  onRunHealthCheck: () => void;
  onCancelHealthCheck: () => void;
  onClearHealthCheck: () => void;
  healthLoading: boolean;
  healthHasResults: boolean;
  canRunHealthCheck: boolean;
  canCopyFileTree: boolean;
  flow: ReactFlowInstance | null;
  fileTreeButtonLabel: string;
  fileTreeError: string | null;
  onCopyFileTree: () => void;
}

function exportSvg(): void {
  const svg = document.querySelector(".react-flow__renderer svg");
  if (!svg) {
    return;
  }
  const blob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reactgraph.svg";
  link.click();
  URL.revokeObjectURL(url);
}

export default function Toolbar({
  filters,
  onToggleFilter,
  impactMode,
  onToggleImpact,
  onRunHealthCheck,
  onCancelHealthCheck,
  onClearHealthCheck,
  healthLoading,
  healthHasResults,
  canRunHealthCheck,
  canCopyFileTree,
  flow,
  fileTreeButtonLabel,
  fileTreeError,
  onCopyFileTree
}: ToolbarProps) {
  const zoomPercent = flow ? `${Math.round(flow.getZoom() * 100)}%` : "100%";

  return (
    <div className="toolbar">
      <div className="toolbar__section">
        <button onClick={() => flow?.zoomOut()} type="button">
          -
        </button>
        <span className="toolbar__zoom">{zoomPercent}</span>
        <button onClick={() => flow?.zoomIn()} type="button">
          +
        </button>
        <button onClick={() => flow?.fitView({ padding: 0.2 })} type="button">
          Fit
        </button>
      </div>
      <div className="toolbar__section">
        {([
          ["components", "Components"],
          ["hooks", "Hooks"],
          ["apis", "APIs"],
          ["context", "Context"]
        ] as const).map(([key, label]) => (
          <button
            className={filters[key] ? "is-active" : ""}
            key={key}
            onClick={() => onToggleFilter(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="toolbar__section">
        <button className={impactMode ? "is-active" : ""} onClick={onToggleImpact} type="button">
          Impact Analysis
        </button>
        <button
          className={healthLoading || healthHasResults ? "is-active" : ""}
          disabled={!canRunHealthCheck}
          onClick={onRunHealthCheck}
          type="button"
        >
          {healthLoading ? "Checking..." : "Health Check"}
        </button>
        {healthLoading ? (
          <button className="toolbar__cancel" onClick={onCancelHealthCheck} type="button">
            Cancel
          </button>
        ) : null}
        {healthHasResults && !healthLoading ? (
          <button onClick={onClearHealthCheck} type="button">
            Clear
          </button>
        ) : null}
        <button onClick={exportSvg} type="button">
          Export SVG
        </button>
        <div className="toolbar__file-tree">
          <button disabled={!canCopyFileTree} onClick={onCopyFileTree} type="button">
            <FolderTree size={16} strokeWidth={2} />
            <span>{fileTreeButtonLabel}</span>
          </button>
          {fileTreeError ? <span className="toolbar__error">{fileTreeError}</span> : null}
        </div>
      </div>
    </div>
  );
}
