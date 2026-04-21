export type {
  ApiNode,
  ComponentNode,
  Edge,
  GraphData,
  HookNode,
  PageNode,
  Param,
  Prop,
  ReturnValue
} from "@reactgraph/core";

export interface ContextGraphNode {
  id: string;
  name: string;
  type: "context";
  filePath: string;
  properties: Array<{ name: string; type: string }>;
}

export type GraphNodeRecord =
  | import("@reactgraph/core").PageNode
  | import("@reactgraph/core").ComponentNode
  | import("@reactgraph/core").HookNode
  | import("@reactgraph/core").ApiNode
  | ContextGraphNode;

export interface ImpactResult {
  affected: string[];
  indirect: string[];
}

export interface FilterState {
  components: boolean;
  hooks: boolean;
  apis: boolean;
  context: boolean;
}
