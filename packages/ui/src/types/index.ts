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
} from "@robinnayak/reactgraph-core";

export interface ContextGraphNode {
  id: string;
  name: string;
  type: "context";
  filePath: string;
  properties: Array<{ name: string; type: string }>;
}

export type GraphNodeRecord =
  | import("@robinnayak/reactgraph-core").PageNode
  | import("@robinnayak/reactgraph-core").ComponentNode
  | import("@robinnayak/reactgraph-core").HookNode
  | import("@robinnayak/reactgraph-core").ApiNode
  | ContextGraphNode;

export interface ImpactResult {
  affected: string[];
  indirect: string[];
}

export type HealthSeverity = "error" | "warning";

export interface HealthIssue {
  filePath: string;
  absolutePath?: string;
  severity: HealthSeverity;
  code?: number;
  message: string;
  source?: string;
}

export interface HealthConfigWarning {
  severity: "warning";
  title: string;
  message: string;
  suggestedFix: string;
  occurrenceCount: number;
  affectedFiles: string[];
}

export interface HealthDisplayIssue {
  id: string;
  severity: HealthSeverity;
  message: string;
  fileCount: number;
  filePaths: string[];
  occurrenceCount: number;
  code?: number;
  source?: string;
  kind: "single" | "deduplicated";
}

export interface HealthSummary {
  uniqueIssueCount: number;
  rawIssueCount: number;
  deduplicatedErrorCount: number;
  deduplicatedWarningCount: number;
  repeatedIssueSavings: number;
  recommendation: string;
}

export interface HealthCheckResults {
  issues: HealthIssue[];
  displayIssues: HealthDisplayIssue[];
  configurationWarning: HealthConfigWarning | null;
  summary: HealthSummary;
  errorCount: number;
  warningCount: number;
  fileCount: number;
  clean: boolean;
  cancelled?: boolean;
  generatedAt: string;
}

export interface FilterState {
  components: boolean;
  hooks: boolean;
  apis: boolean;
  context: boolean;
}
