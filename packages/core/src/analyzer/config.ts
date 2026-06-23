import fs from "node:fs";
import path from "node:path";
import { globSync } from "glob";
import { DEFAULT_IGNORES, relativeFilePath } from "./shared.js";

export interface AnalyzerConfig {
  pagePatterns: string[];
  pageFiles: Set<string>;
}

export interface AnalyzerConfigInput {
  pagePatterns?: string[];
}

const CONFIG_FILE_NAME = "reactgraph.config.json";

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizePatterns(patterns: unknown): string[] {
  if (!Array.isArray(patterns)) {
    return [];
  }

  return patterns
    .filter((pattern): pattern is string => typeof pattern === "string" && pattern.trim().length > 0)
    .map((pattern) => normalizePath(pattern.trim()));
}

function readProjectConfig(projectRoot: string): AnalyzerConfigInput {
  const configPath = path.join(projectRoot, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as { pagePatterns?: unknown };
    return {
      pagePatterns: normalizePatterns(parsed.pagePatterns)
    };
  } catch (error) {
    console.warn(`[ReactGraph] Failed to read ${CONFIG_FILE_NAME}: ${(error as Error).message}`);
    return {};
  }
}

export function resolveAnalyzerConfig(projectRoot: string, options: AnalyzerConfigInput = {}): AnalyzerConfig {
  const projectConfig = readProjectConfig(projectRoot);
  const pagePatterns = [...normalizePatterns(projectConfig.pagePatterns), ...normalizePatterns(options.pagePatterns)];
  const pageFiles = new Set(
    pagePatterns.flatMap((pattern) =>
      globSync(pattern, {
        cwd: projectRoot,
        absolute: true,
        nodir: true,
        ignore: DEFAULT_IGNORES
      }).map((filePath) => normalizePath(relativeFilePath(projectRoot, filePath)))
    )
  );

  return { pagePatterns, pageFiles };
}

