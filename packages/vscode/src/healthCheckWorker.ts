import path from "node:path";
import fs from "node:fs";
import ts from "typescript";

const EXCLUDED_SEGMENTS = [".next", "node_modules", "dist", "build", ".turbo", ".cache"] as const;
const ALLOWED_SOURCE_DIRS = ["src", "app", "pages", "components", "hooks", "lib"] as const;

interface WorkerIssue {
  filePath: string;
  absolutePath: string;
  severity: "error" | "warning";
  code?: number;
  message: string;
  source?: string;
}

interface WorkerDisplayIssue {
  id: string;
  severity: "error" | "warning";
  message: string;
  fileCount: number;
  filePaths: string[];
  occurrenceCount: number;
  code?: number;
  source?: string;
  kind: "single" | "deduplicated";
}

interface WorkerConfigWarning {
  severity: "warning";
  title: string;
  message: string;
  suggestedFix: string;
  occurrenceCount: number;
  affectedFiles: string[];
}

interface WorkerSummary {
  uniqueIssueCount: number;
  rawIssueCount: number;
  deduplicatedErrorCount: number;
  deduplicatedWarningCount: number;
  repeatedIssueSavings: number;
  recommendation: string;
}

interface WorkerResult {
  issues: WorkerIssue[];
  displayIssues: WorkerDisplayIssue[];
  configurationWarning: WorkerConfigWarning | null;
  summary: WorkerSummary;
  errorCount: number;
  warningCount: number;
  fileCount: number;
  clean: boolean;
  generatedAt: string;
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function isExcludedPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return EXCLUDED_SEGMENTS.some((segment) => normalized.includes(`/${segment}/`) || normalized.startsWith(`${segment}/`));
}

function isUserSourceFile(workspaceRoot: string, filePath: string): boolean {
  const relativePath = normalizePath(path.relative(workspaceRoot, filePath));

  if (!relativePath || relativePath === ".") {
    return false;
  }

  if (isExcludedPath(relativePath)) {
    return false;
  }

  if (!relativePath.includes("/")) {
    return true;
  }

  return ALLOWED_SOURCE_DIRS.some(
    (segment) => relativePath.startsWith(`${segment}/`) || relativePath.includes(`/${segment}/`)
  );
}

function toIssue(workspaceRoot: string, diagnostic: ts.Diagnostic): WorkerIssue {
  const absolutePath = diagnostic.file?.fileName ?? workspaceRoot;
  const filePath = diagnostic.file ? path.relative(workspaceRoot, absolutePath) : "tsconfig.json";
  const severity = diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning";

  return {
    filePath: normalizePath(filePath),
    absolutePath,
    severity,
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    source: diagnostic.source
  };
}

function buildProgram(configPath: string) {
  const host = ts.sys;
  const parsed = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...host,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  });

  if (!parsed) {
    throw new Error(`Unable to load TypeScript project config from ${configPath}.`);
  }

  const workspaceRoot = path.dirname(configPath);
  const filteredFileNames = parsed.fileNames.filter((fileName) => isUserSourceFile(workspaceRoot, fileName));

  return {
    parsed,
    program: ts.createProgram({
      rootNames: filteredFileNames,
      options: parsed.options,
      projectReferences: parsed.projectReferences
    })
  };
}

function resolveProjectConfigPath(workspaceRoot: string): string | null {
  const tsConfigPath = path.join(workspaceRoot, "tsconfig.json");
  if (fs.existsSync(tsConfigPath)) {
    return tsConfigPath;
  }

  const baseConfigPath = path.join(workspaceRoot, "tsconfig.base.json");
  if (fs.existsSync(baseConfigPath)) {
    return baseConfigPath;
  }

  return null;
}

function isConfigurationIssue(issue: WorkerIssue): boolean {
  const message = issue.message.toLowerCase();
  return (
    (message.includes("cannot find name") && (message.includes("'json'") || message.includes("'promise'"))) ||
    message.includes("change your target library") ||
    message.includes("try changing the 'lib' compiler option")
  );
}

function detectConfigurationWarning(issues: WorkerIssue[]): WorkerConfigWarning | null {
  const matchingIssues = issues.filter(isConfigurationIssue);
  if (matchingIssues.length <= 10) {
    return null;
  }

  return {
    severity: "warning",
    title: "Likely tsconfig configuration root cause",
    message:
      "Many diagnostics point to missing standard library types such as Promise or JSON, which usually means the workspace TypeScript config needs a lib, target, or environment fix.",
    suggestedFix:
      "Check the root tsconfig.json and verify compilerOptions.lib, target, and environment settings before fixing individual files.",
    occurrenceCount: matchingIssues.length,
    affectedFiles: Array.from(new Set(matchingIssues.map((issue) => issue.filePath))).sort()
  };
}

function buildDisplayIssues(issues: WorkerIssue[]): WorkerDisplayIssue[] {
  const grouped = new Map<string, WorkerIssue[]>();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.code ?? "na"}:${issue.message}`;
    const existing = grouped.get(key) ?? [];
    existing.push(issue);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([key, group]) => {
      const filePaths = Array.from(new Set(group.map((issue) => issue.filePath))).sort();
      return {
        id: key,
        severity: group[0].severity,
        message: group[0].message,
        fileCount: filePaths.length,
        filePaths,
        occurrenceCount: group.length,
        code: group[0].code,
        source: group[0].source,
        kind: filePaths.length > 3 ? ("deduplicated" as const) : ("single" as const)
      };
    })
    .sort((left, right) => {
      const severityOrder = left.severity === right.severity ? 0 : left.severity === "error" ? -1 : 1;
      if (severityOrder !== 0) {
        return severityOrder;
      }
      return right.occurrenceCount - left.occurrenceCount;
    });
}

function buildRecommendation(
  configurationWarning: WorkerConfigWarning | null,
  displayIssues: WorkerDisplayIssue[]
): string {
  if (configurationWarning) {
    return "Fix the root tsconfig first, then rerun Health Check to clear the shared configuration noise.";
  }

  const topIssue = displayIssues[0];
  if (!topIssue) {
    return "No action needed.";
  }

  if (topIssue.kind === "deduplicated") {
    return `Start with the repeated "${topIssue.message}" issue because it affects ${topIssue.fileCount} files.`;
  }

  return `Start with the highest-severity issue in ${topIssue.filePaths[0] ?? "the workspace"} to reduce follow-on noise.`;
}

function postProcessIssues(issues: WorkerIssue[]) {
  const configurationWarning = detectConfigurationWarning(issues);
  const remainingIssues = configurationWarning ? issues.filter((issue) => !isConfigurationIssue(issue)) : issues;
  const displayIssues = buildDisplayIssues(remainingIssues);
  const deduplicatedErrorCount = displayIssues.filter((issue) => issue.severity === "error").length;
  const deduplicatedWarningCount =
    displayIssues.filter((issue) => issue.severity === "warning").length + (configurationWarning ? 1 : 0);
  const rawIssueCount = issues.length;
  const uniqueIssueCount = displayIssues.length + (configurationWarning ? 1 : 0);
  const repeatedIssueSavings = rawIssueCount - uniqueIssueCount;

  return {
    configurationWarning,
    displayIssues,
    summary: {
      uniqueIssueCount,
      rawIssueCount,
      deduplicatedErrorCount,
      deduplicatedWarningCount,
      repeatedIssueSavings,
      recommendation: buildRecommendation(configurationWarning, displayIssues)
    } satisfies WorkerSummary
  };
}

function runHealthCheck(workspaceRoot: string): WorkerResult {
  const configPath = resolveProjectConfigPath(workspaceRoot);

  if (!configPath) {
    throw new Error("No tsconfig.json found - Health Check requires a TypeScript project.");
  }

  const { parsed, program } = buildProgram(configPath);
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].filter((diagnostic) => {
    if (!diagnostic.file?.fileName) {
      return true;
    }

    return isUserSourceFile(workspaceRoot, diagnostic.file.fileName);
  });

  const issues = diagnostics.map((diagnostic) => toIssue(workspaceRoot, diagnostic));
  const { configurationWarning, displayIssues, summary } = postProcessIssues(issues);
  const fileCount = new Set(issues.map((issue) => issue.filePath)).size;

  return {
    issues,
    displayIssues,
    configurationWarning,
    summary,
    errorCount: summary.deduplicatedErrorCount,
    warningCount: summary.deduplicatedWarningCount,
    fileCount,
    clean: issues.length === 0,
    generatedAt: new Date().toISOString()
  };
}

function sendMessage(message: unknown): void {
  if (typeof process.send === "function") {
    process.send(message);
  }
}

function main(): void {
  const workspaceRoot = process.argv[2];
  if (!workspaceRoot) {
    throw new Error("Missing workspace path for health check.");
  }

  const results = runHealthCheck(workspaceRoot);
  sendMessage({ type: "healthCheckResult", results });
}

try {
  main();
} catch (error) {
  sendMessage({
    type: "healthCheckError",
    error: error instanceof Error ? error.message : "Unknown health check failure"
  });
  process.exitCode = 1;
}
