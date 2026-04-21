import type { NodeProps } from "reactflow";

export interface BaseNodeData {
  label: string;
  filePath: string;
  kindLabel: string;
  color: string;
  borderStyle?: "solid" | "dashed";
  isShared?: boolean;
  fields?: Array<{ name: string; type: string; required?: boolean }>;
}

export function NodeCard({ data }: NodeProps<BaseNodeData>) {
  const fields = data.fields ?? [];

  return (
    <div
      className="graph-node"
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
            <div className="graph-node__title">{data.label}</div>
          </div>
          {data.isShared ? <span className="graph-node__badge">SHARED</span> : null}
        </div>
        <div className="graph-node__path">{data.filePath}</div>
        {fields.length > 0 ? (
          <div
            className="graph-node__fields"
            style={{ borderTop: "1px solid #30363d", marginTop: 6, paddingTop: 6 }}
          >
            {fields.slice(0, 3).map((field) => (
              <div
                className="graph-node__field"
                key={`${field.name}:${field.type}`}
                style={{ fontSize: 10, fontFamily: "monospace", lineHeight: "1.6" }}
              >
                <span className="graph-node__field-name" style={{ color: "#79c0ff" }}>
                  {field.name}
                </span>
                <span style={{ color: "#8b949e" }}>: </span>
                <span className="graph-node__field-type" style={{ color: "#ffa657" }}>
                  {field.type}
                </span>
                <span
                  className="graph-node__field-required"
                  style={{ color: field.required === false ? "#8b949e" : "#3fb950", marginLeft: 4 }}
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
