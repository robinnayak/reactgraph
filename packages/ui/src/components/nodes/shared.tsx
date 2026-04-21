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
          <div className="graph-node__fields">
            {fields.slice(0, 3).map((field) => (
              <div className="graph-node__field" key={`${field.name}:${field.type}`}>
                <span className="graph-node__field-name">{field.name}</span>
                <span className="graph-node__field-type">{field.type}</span>
                <span className="graph-node__field-required">
                  {field.required === false ? "?" : "✓"}
                </span>
              </div>
            ))}
            {fields.length > 3 ? <div className="graph-node__field-more">+ {fields.length - 3} more</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
