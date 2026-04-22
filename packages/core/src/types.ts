export interface GraphData {
  pages: PageNode[];
  components: ComponentNode[];
  hooks: HookNode[];
  apis: ApiNode[];
  edges: Edge[];
}

export interface PageNode {
  id: string;
  name: string;
  filePath: string;
  type: "page";
}

export interface ComponentNode {
  id: string;
  name: string;
  filePath: string;
  type: "component";
  props: Prop[];
  isShared: boolean;
  usedInPages: string[];
  usageCount: number;
  shouldMoveToShared: boolean;
  isUnused: boolean;
  unusedReason?: string;
}

export interface HookNode {
  id: string;
  name: string;
  filePath: string;
  type: "hook";
  params: Param[];
  returns: ReturnValue[];
}

export interface ApiNode {
  id: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  type: "api";
  payload?: Record<string, string>;
}

export interface Prop {
  name: string;
  type: string;
  required: boolean;
}

export interface Param {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface ReturnValue {
  name: string;
  type: string;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  relationshipType: "renders" | "uses" | "calls" | "provides";
  props?: Prop[];
}

export interface ComponentMeta {
  node: ComponentNode;
  exports: Set<string>;
}

export interface HookMeta {
  node: HookNode;
  exports: Set<string>;
}

export interface ParsedModule {
  filePath: string;
  source: string;
  ast: unknown;
  imports: Map<string, string>;
  exports: Set<string>;
  defaultExportName?: string;
}
