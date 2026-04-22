import { useEffect, useState } from "react";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import tsxLanguage from "shiki/langs/tsx.mjs";
import typescriptLanguage from "shiki/langs/typescript.mjs";
import githubDark from "shiki/themes/github-dark.mjs";
import type { Edge, GraphNodeRecord } from "../types";

type HighlightLanguage = "tsx" | "typescript";

let highlighterPromise: Promise<Awaited<ReturnType<typeof createHighlighterCore>>> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [githubDark],
      langs: [tsxLanguage, typescriptLanguage],
      engine: createJavaScriptRegexEngine()
    });
  }

  return highlighterPromise;
}

async function highlightCodeSnippet(code: string, language: HighlightLanguage): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: language,
    theme: "github-dark"
  });
}

interface NodeInspectorProps {
  node: GraphNodeRecord | null;
  allNodes: GraphNodeRecord[];
  dependencies: GraphNodeRecord[];
  usedIn: GraphNodeRecord[];
  edges: Edge[];
  onClose: () => void;
  onPageSelect: (pageId: string) => void;
  onJumpToNode: (nodeId: string) => void;
  onOpenInIde: (filePath: string) => void;
}

function dependencyCount(node: GraphNodeRecord, edges: Edge[]): number {
  return edges.filter((edge) => edge.source === node.id).length;
}

export default function NodeInspector({
  node,
  allNodes,
  dependencies,
  usedIn,
  edges,
  onClose,
  onPageSelect,
  onJumpToNode,
  onOpenInIde
}: NodeInspectorProps) {
  const [highlighted, setHighlighted] = useState<string>("");
  const [copyButtonLabel, setCopyButtonLabel] = useState("Copy suggested path");

  useEffect(() => {
    let cancelled = false;

    async function highlightSnippet() {
      if (!node) {
        setHighlighted("");
        return;
      }
      const snippet = `// ${node.name}\n// ${node.filePath}\nexport const meta = ${JSON.stringify(node, null, 2)};`;
      const html = await highlightCodeSnippet(snippet, "typescript");
      if (!cancelled) {
        setHighlighted(html);
      }
    }

    void highlightSnippet();
    return () => {
      cancelled = true;
    };
  }, [node]);

  useEffect(() => {
    setCopyButtonLabel("Copy suggested path");
  }, [node]);

  if (!node) {
    return null;
  }

  const props = "props" in node ? node.props : [];
  const params = "params" in node ? node.params : [];
  const returns = "returns" in node ? node.returns : [];
  const componentUsage =
    node.type === "component"
      ? node.usedInPages
          .map((pageId) => {
            const page = allNodes.find((entry): entry is Extract<GraphNodeRecord, { type: "page" }> => entry.id === pageId && entry.type === "page");
            if (!page) {
              return null;
            }

            const isDirect = edges.some(
              (edge) => edge.relationshipType === "renders" && edge.source === page.id && edge.target === node.id
            );

            return {
              page,
              isIndirect: !isDirect
            };
          })
          .filter((entry): entry is { page: Extract<GraphNodeRecord, { type: "page" }>; isIndirect: boolean } => Boolean(entry))
      : [];
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;
  const handlePageChipClick = (pageId: string) => {
    onPageSelect(pageId);
    onClose();
  };
  const handleUsedInClick = (entry: GraphNodeRecord) => {
    if (entry.type === "page") {
      handlePageChipClick(entry.id);
      return;
    }

    onJumpToNode(entry.id);
  };
  const copyWithFallback = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };
  const copySuggestedPath = async () => {
    if (node.type !== "component") {
      return;
    }

    const fileName = node.filePath.split(/[/\\]/).pop();
    if (!fileName) {
      return;
    }

    try {
      await copyWithFallback(`components/shared/${fileName}`);
      setCopyButtonLabel("Copied!");
      window.setTimeout(() => setCopyButtonLabel("Copy suggested path"), 2000);
    } catch {
      // Ignore clipboard failures in constrained environments.
    }
  };

  return (
    <aside className="inspector">
      <div className="inspector__header">
        <div>
          <div className="inspector__title" style={ellipsisStyle} title={node.name}>
            {node.name}
          </div>
          <div className="inspector__path" style={ellipsisStyle} title={node.filePath}>
            {node.filePath}
          </div>
        </div>
        <button onClick={onClose} type="button">Close</button>
      </div>

      <div className="inspector__metrics">
        <div>
          <span>TYPE</span>
          <strong>{node.type}</strong>
        </div>
        <div>
          <span>DEP COUNT</span>
          <strong>{dependencyCount(node, edges)}</strong>
        </div>
      </div>

      {params.length > 0 ? (
        <section>
          <h3>Params</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {params.map((param) => (
                <tr key={param.name}>
                  <td>{param.name}</td>
                  <td>{param.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {returns.length > 0 ? (
        <section>
          <h3>Returns</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((value) => (
                <tr key={`${value.name}:${value.type}`}>
                  <td>{value.name}</td>
                  <td className="type-cell">{value.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {props.length > 0 ? (
        <section>
          <h3>Properties</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Type</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {props.map((prop) => (
                <tr key={`${prop.name}:${prop.type}`}>
                  <td title={prop.name}>{prop.name}</td>
                  <td className="type-cell" title={prop.type}>{prop.type}</td>
                  <td>{prop.required ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {node.type === "component" ? (
        <section>
          <h3>Usage Analysis</h3>
          <div className="inspector__stack">
            <div className="inspector__meta-row">
              <strong>Pages using this component:</strong>
              <div className="chip-list">
                {componentUsage.length > 0 ? (
                  componentUsage.map(({ page, isIndirect }) => (
                    <button
                      className="chip-list__button chip-list__button--page"
                      key={page.id}
                      onClick={() => handlePageChipClick(page.id)}
                      type="button"
                    >
                      {page.name}
                      {isIndirect ? <span className="chip-list__meta">(indirect)</span> : null}
                    </button>
                  ))
                ) : (
                  <span className="inspector__muted">No pages reach this component.</span>
                )}
              </div>
            </div>
            <div className="inspector__muted">
              Usage count: {node.usageCount} {node.usageCount === 1 ? "page" : "pages"}
            </div>
            {node.shouldMoveToShared ? (
              <div className="inspector__callout inspector__callout--warning">
                {"\u26A1"} Suggestion: This component is used in {node.usageCount} pages but lives outside the shared/
                folder. Consider moving it to components/shared/ for better organization.
                <button className="inspector__copy-button" onClick={() => void copySuggestedPath()} type="button">
                  {copyButtonLabel}
                </button>
              </div>
            ) : null}
            {node.isUnused ? (
              <div className="inspector__callout inspector__callout--danger">
                {"\u26A0\uFE0F"} Unused Component: This component is not referenced by any page or component. It may be safe to
                delete.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {node.type === "api" ? (
        <section>
          <h3>API Details</h3>
          <div className="api-card">
            <span className={`method method-${node.method.toLowerCase()}`}>{node.method}</span>
            <code>{node.endpoint}</code>
            {"payload" in node && node.payload ? <pre>{JSON.stringify(node.payload, null, 2)}</pre> : null}
          </div>
        </section>
      ) : null}

      <section>
        <h3>Dependencies</h3>
        <div className="chip-list">
          {dependencies.map((dependency) => (
            <button key={dependency.id} onClick={() => onJumpToNode(dependency.id)} type="button">
              {dependency.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Used In</h3>
        <div className="chip-list">
          {usedIn.map((entry) => (
            <button
              className={entry.type === "page" ? "chip-list__button chip-list__button--page" : "chip-list__button"}
              key={entry.id}
              onClick={() => handleUsedInClick(entry)}
              type="button"
            >
              {entry.name}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3>Code Context</h3>
        <div className="code-context" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </section>

      <button className="open-ide" onClick={() => onOpenInIde(node.filePath)} type="button">
        Open in IDE
      </button>
    </aside>
  );
}
