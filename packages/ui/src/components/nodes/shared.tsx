import type { NodeProps } from "reactflow";
import type { HealthSeverity } from "../../types";

export interface BaseNodeData {
  label: string;
  filePath: string;
  kindLabel: string;
  color: string;
  borderStyle?: "solid" | "dashed";
  isShared?: boolean;
  shouldMoveToShared?: boolean;
  isUnused?: boolean;
  hasCircularDependency?: boolean;
  hasPropDrilling?: boolean;
  usageCount?: number;
  fields?: Array<{ name: string; type: string; required?: boolean }>;
  emphasis?: "normal" | "selected" | "direct" | "indirect" | "dimmed";
  issueBadge?: {
    severity: HealthSeverity;
    errorCount: number;
    warningCount: number;
  } | null;
}

export function NodeCard({ data }: NodeProps<BaseNodeData>) {
  const fields = data.fields ?? [];
  const emphasisClass = data.emphasis ? `graph-node--${data.emphasis}` : "graph-node--normal";
  const healthClass = data.hasCircularDependency
    ? " graph-node--circular"
    : data.isUnused
      ? " graph-node--unused"
      : data.hasPropDrilling
        ? " graph-node--prop-drill"
        : "";
  const issueLabel = data.issueBadge
    ? `${data.issueBadge.errorCount + data.issueBadge.warningCount} issue${data.issueBadge.errorCount + data.issueBadge.warningCount === 1 ? "" : "s"}`
    : "";
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;
  const badge = data.hasCircularDependency
    ? { label: "CIRCULAR", className: "graph-node__badge graph-node__badge--circular" }
    : data.isUnused
      ? { label: "UNUSED", className: "graph-node__badge graph-node__badge--unused" }
      : data.hasPropDrilling
        ? { label: "PROP DRILL", className: "graph-node__badge graph-node__badge--prop-drill" }
        : data.shouldMoveToShared
          ? { label: "MOVE TO SHARED", className: "graph-node__badge graph-node__badge--move" }
          : data.isShared
            ? { label: "SHARED", className: "graph-node__badge" }
            : null;

  return (
    <div
      className={`graph-node ${emphasisClass}${healthClass}`}
      style={{
        borderStyle: data.borderStyle ?? "solid",
        boxShadow: `0 0 20px color-mix(in srgb, ${data.color} 10%, transparent)`
      }}
    >
      <div className="graph-node__bar" style={{ background: data.color }} />
      <div className="graph-node__body">
        <div className="graph-node__header">
          <div>
            <div className="graph-node__kind" style={{ color: data.color }}>
              {data.kindLabel}
            </div>
            <div className="graph-node__title" style={ellipsisStyle} title={data.label}>
              {data.label}
            </div>
          </div>
          <div className="graph-node__meta">
            {data.issueBadge ? (
              <span
                aria-label={issueLabel}
                className={`graph-node__issue graph-node__issue--${data.issueBadge.severity}`}
                title={issueLabel}
              >
                {data.issueBadge.errorCount > 0 ? data.issueBadge.errorCount : data.issueBadge.warningCount}
              </span>
            ) : null}
            {badge ? <span className={badge.className}>{badge.label}</span> : null}
          </div>
        </div>
        <div className="graph-node__path" style={ellipsisStyle} title={data.filePath}>
          {data.filePath}
        </div>
        {data.usageCount && data.usageCount > 0 ? (
          <div className="graph-node__usage">Used in {data.usageCount} {data.usageCount === 1 ? "page" : "pages"}</div>
        ) : null}
        {fields.length > 0 ? (
          <div
            className="graph-node__fields"
            style={{ borderTop: "1px solid #30363d", marginTop: 6, paddingTop: 6 }}
          >
            {fields.slice(0, 3).map((field) => (
              <div
                className="graph-node__field"
                key={`${field.name}:${field.type}`}
                title={`${field.name}: ${field.type}${field.required === false ? "?" : " req"}`}
                style={{ fontSize: 10, fontFamily: "monospace", lineHeight: "1.6" }}
              >
                <span className="graph-node__field-name" style={ellipsisStyle} title={field.name}>
                  {field.name}
                </span>
                <span style={{ color: "#8b949e" }}>: </span>
                <span className="graph-node__field-type" style={ellipsisStyle} title={field.type}>
                  {field.type}
                </span>
                <span
                  className="graph-node__field-required"
                  style={{ color: field.required === false ? "#8b949e" : "#3fb950", marginLeft: 4 }}
                  title={field.required === false ? "Optional" : "Required"}
                >
                  {field.required === false ? "?" : "req"}
                </span>
              </div>
            ))}
            {fields.length > 3 ? (
              <div className="graph-node__field-more" style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>
                +{fields.length - 3} more
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
