import type { NodeProps } from "reactflow";
import { NodeCard, type BaseNodeData } from "./shared";

export default function ComponentNode(props: NodeProps<BaseNodeData>) {
  return <NodeCard {...props} />;
}
