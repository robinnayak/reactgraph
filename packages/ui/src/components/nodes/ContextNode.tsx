import type { NodeProps } from "reactflow";
import { NodeCard, type BaseNodeData } from "./shared";

export default function ContextNode(props: NodeProps<BaseNodeData>) {
  return <NodeCard {...props} />;
}
