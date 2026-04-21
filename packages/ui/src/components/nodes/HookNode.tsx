import type { NodeProps } from "reactflow";
import { NodeCard, type BaseNodeData } from "./shared";

export default function HookNode(props: NodeProps<BaseNodeData>) {
  return <NodeCard {...props} />;
}
