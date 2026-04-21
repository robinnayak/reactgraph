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
  dependencies: GraphNodeRecord[];
  usedIn: GraphNodeRecord[];
  edges: Edge[];
  onClose: () => void;
  onJumpToNode: (nodeId: string) => void;
  onOpenInIde: (filePath: string) => void;
}

function dependencyCount(node: GraphNodeRecord, edges: Edge[]): number {
  return edges.filter((edge) => edge.source === node.id).length;
}

export default function NodeInspector({
  node,
  dependencies,
  usedIn,
  edges,
  onClose,
  onJumpToNode,
  onOpenInIde
}: NodeInspectorProps) {
  const [highlighted, setHighlighted] = useState<string>("");

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

  if (!node) {
    return null;
  }

  const props = "props" in node ? node.props : [];
  const params = "params" in node ? node.params : [];
  const returns = "returns" in node ? node.returns : [];

  return (
    <aside className="inspector">
      <div className="inspector__header">
        <div>
          <div className="inspector__title">{node.name}</div>
          <div className="inspector__path">{node.filePath}</div>
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
                  <td>{prop.name}</td>
                  <td className="type-cell">{prop.type}</td>
                  <td>{prop.required ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <button key={entry.id} onClick={() => onJumpToNode(entry.id)} type="button">
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
