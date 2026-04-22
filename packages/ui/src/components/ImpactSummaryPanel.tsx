import { useState } from "react";
import type { GraphNodeRecord, HealthCheckResults, HealthDisplayIssue } from "../types";

type GraphSectionKey = "page" | "component" | "hook" | "api";

interface ImpactSummaryData {
  selectedNode: GraphNodeRecord;
  affectedPages: GraphNodeRecord[];
  affectedComponents: GraphNodeRecord[];
  affectedHooks: GraphNodeRecord[];
  safePages: GraphNodeRecord[];
  directCount: number;
  indirectCount: number;
}

interface ImpactSummaryPanelProps {
  impactSummary: ImpactSummaryData | null;
  healthResults: HealthCheckResults | null;
  healthSections: Record<GraphSectionKey, HealthDisplayIssue[]>;
  healthPageStats: {
    affectedPages: number;
    cleanPages: number;
  };
  onClearHealth: () => void;
}

function pluralize(label: string, count: number): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function IssueList(props: { issues: HealthDisplayIssue[] }) {
  const { issues } = props;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;

  return (
    <div className="summary-panel__issues">
      {issues.map((issue) => (
        <div className="summary-panel__issue" key={issue.id}>
          <div className="summary-panel__issue-row">
            <span className={`summary-panel__pill summary-panel__pill--${issue.severity}`}>{issue.severity}</span>
            <code
              style={ellipsisStyle}
              title={issue.fileCount === 1 ? issue.filePaths[0] : issue.filePaths.join("\n")}
            >
              {issue.fileCount === 1 ? issue.filePaths[0] : `${issue.fileCount} files affected`}
            </code>
          </div>
          <p>{issue.message}</p>
          {issue.kind === "deduplicated" ? (
            <>
              <div className="summary-panel__meta">
                Repeated in {issue.fileCount} files and {issue.occurrenceCount} total diagnostics.
              </div>
              <button
                className="summary-panel__toggle"
                onClick={() => setExpanded((current) => ({ ...current, [issue.id]: !current[issue.id] }))}
                type="button"
              >
                {expanded[issue.id] ? "Hide files" : "Show files"}
              </button>
              {expanded[issue.id] ? (
                <div className="summary-panel__file-list">
                  {issue.filePaths.map((filePath) => (
                    <code key={filePath} style={ellipsisStyle} title={filePath}>
                      {filePath}
                    </code>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function NodeList(props: { emptyLabel: string; nodes: GraphNodeRecord[] }) {
  const { emptyLabel, nodes } = props;
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;

  if (nodes.length === 0) {
    return <div className="summary-panel__empty">{emptyLabel}</div>;
  }

  return (
    <div className="summary-panel__list">
      {nodes.map((node) => (
        <div className="summary-panel__item" key={node.id}>
          <span style={ellipsisStyle} title={node.name}>
            {node.name}
          </span>
          {"filePath" in node ? (
            <code style={ellipsisStyle} title={node.filePath}>
              {node.filePath}
            </code>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function ImpactSummaryPanel(props: ImpactSummaryPanelProps) {
  const { impactSummary, healthResults, healthSections, healthPageStats, onClearHealth } = props;

  if (!impactSummary && !healthResults) {
    return null;
  }

  return (
    <aside className="summary-panel">
      <div className="summary-panel__header">
        <div>
          <div className="summary-panel__eyebrow">Impact Summary</div>
          <h2>{impactSummary ? impactSummary.selectedNode.name : "Health Check Results"}</h2>
        </div>
        {healthResults ? (
          <button className="summary-panel__ghost" onClick={onClearHealth} type="button">
            Clear
          </button>
        ) : null}
      </div>

      {impactSummary ? (
        <section className="summary-panel__section">
          <div className="summary-panel__stats">
            <div>
              <span>Selected</span>
              <strong>{impactSummary.selectedNode.type}</strong>
            </div>
            <div>
              <span>Direct</span>
              <strong>{impactSummary.directCount}</strong>
            </div>
            <div>
              <span>Indirect</span>
              <strong>{impactSummary.indirectCount}</strong>
            </div>
          </div>

          {"isShared" in impactSummary.selectedNode && impactSummary.selectedNode.isShared ? (
            <div className="summary-panel__warning">
              Shared component warning: this node is reused across multiple pages, so a change here has the highest
              blast radius.
            </div>
          ) : null}

          <div className="summary-panel__group">
            <h3>{pluralize("affected page", impactSummary.affectedPages.length)}</h3>
            <NodeList emptyLabel="No pages are affected by this change." nodes={impactSummary.affectedPages} />
          </div>

          <div className="summary-panel__group">
            <h3>{pluralize("affected component", impactSummary.affectedComponents.length)}</h3>
            <NodeList
              emptyLabel="No downstream components are affected by this change."
              nodes={impactSummary.affectedComponents}
            />
          </div>

          <div className="summary-panel__group">
            <h3>{pluralize("affected hook", impactSummary.affectedHooks.length)}</h3>
            <NodeList emptyLabel="No hooks are affected by this change." nodes={impactSummary.affectedHooks} />
          </div>

          <div className="summary-panel__group">
            <h3>{pluralize("safe page", impactSummary.safePages.length)}</h3>
            <NodeList emptyLabel="Every page is touched by this selection." nodes={impactSummary.safePages} />
          </div>
        </section>
      ) : null}

      {healthResults ? (
        <section className="summary-panel__section">
          <div className="summary-panel__header summary-panel__header--subsection">
            <div>
              <div className="summary-panel__eyebrow">Health Check</div>
              <h2>
                {healthResults.clean
                  ? "Project is clean and ready to build."
                  : `${healthResults.summary.uniqueIssueCount} unique issues across ${healthResults.fileCount} files.`}
              </h2>
              {!healthResults.clean ? (
                <p className="summary-panel__subtitle">
                  {healthResults.configurationWarning
                    ? `${healthResults.configurationWarning.occurrenceCount} errors share a common tsconfig configuration root cause.`
                    : healthResults.summary.rawIssueCount > healthResults.summary.uniqueIssueCount
                      ? `${healthResults.summary.rawIssueCount - healthResults.summary.uniqueIssueCount} raw diagnostics were collapsed into grouped issues.`
                      : "No duplicate diagnostic groups were collapsed."}
                </p>
              ) : null}
            </div>
          </div>

          {healthResults.clean ? (
            <div className="summary-panel__success">No TypeScript issues were found in the current workspace.</div>
          ) : (
            <>
              <div className="summary-panel__stats summary-panel__stats--health">
                <div>
                  <span>Unique Issues</span>
                  <strong>{healthResults.summary.uniqueIssueCount}</strong>
                </div>
                <div>
                  <span>Affected Pages</span>
                  <strong>{healthPageStats.affectedPages}</strong>
                </div>
                <div>
                  <span>Clean Pages</span>
                  <strong>{healthPageStats.cleanPages}</strong>
                </div>
              </div>
              <div className="summary-panel__recommendation">{healthResults.summary.recommendation}</div>
              {healthResults.configurationWarning ? (
                <div className="summary-panel__warning summary-panel__warning--config">
                  <div className="summary-panel__warning-title">{healthResults.configurationWarning.title}</div>
                  <p>{healthResults.configurationWarning.message}</p>
                  <div className="summary-panel__meta">
                    {healthResults.configurationWarning.occurrenceCount} diagnostics share this root cause.
                  </div>
                  <div className="summary-panel__recommendation">{healthResults.configurationWarning.suggestedFix}</div>
                </div>
              ) : null}
            </>
          )}

          {(
            [
              ["page", "Pages"],
              ["component", "Components"],
              ["hook", "Hooks"],
              ["api", "APIs"]
            ] as const
          ).map(([key, label]) => (
            <div className="summary-panel__group" key={key}>
              <h3>{label}</h3>
              {healthSections[key].length > 0 ? (
                <IssueList issues={healthSections[key]} />
              ) : (
                <div className="summary-panel__empty">No {label.toLowerCase()} with TypeScript issues.</div>
              )}
            </div>
          ))}
        </section>
      ) : null}
    </aside>
  );
}
