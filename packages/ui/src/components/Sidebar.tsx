import type { GraphNodeRecord, PageNode } from "../types";

interface SidebarProps {
  pages: PageNode[];
  nodes: GraphNodeRecord[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export default function Sidebar({
  pages,
  nodes,
  selectedPageId,
  onSelectPage,
  searchQuery,
  onSearchChange
}: SidebarProps) {
  const components = nodes.filter((node) => node.type === "component");
  const hooks = nodes.filter((node) => node.type === "hook");
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;

  return (
    <aside className="sidebar">
      <div className="topbar">
        <div className="topbar__brand">
          <span>ReactGraph Dashboard</span>
          <small>Hierarchy Visualization</small>
        </div>
        <div className="topbar__actions">
          <input
            aria-label="Search graph nodes"
            className="search-input"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search components..."
            value={searchQuery}
          />
        </div>
      </div>
      <div className="sidebar__inner">
        <section>
          <h3>Project Explorer</h3>
          <div className="sidebar__section-list">
            {pages.map((page) => (
              <button
                className={selectedPageId === page.id ? "sidebar__item is-active" : "sidebar__item"}
                key={page.id}
                onClick={() => onSelectPage(page.id)}
                type="button"
              >
                <span className="dot dot-page" />
                <span style={ellipsisStyle} title={page.filePath}>
                  {page.filePath}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>Components</h3>
          <div className="sidebar__section-list">
            {components.slice(0, 8).map((component) => (
              <div className="sidebar__item sidebar__item--static" key={component.id}>
                <span className="dot dot-component" />
                <span style={ellipsisStyle} title={component.name}>
                  {component.name}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h3>Hooks</h3>
          <div className="sidebar__section-list">
            {hooks.slice(0, 6).map((hook) => (
              <div className="sidebar__item sidebar__item--static" key={hook.id}>
                <span className="dot dot-hook" />
                <span style={ellipsisStyle} title={hook.name}>
                  {hook.name}
                </span>
              </div>
            ))}
          </div>
        </section>
        <section className="legend">
          <h3>Node Types</h3>
          <div className="legend__grid">
            <div><span className="dot dot-page" /> Page</div>
            <div><span className="dot dot-component" /> Component</div>
            <div><span className="dot dot-hook" /> Hook</div>
            <div><span className="dot dot-api" /> API</div>
            <div><span className="dot dot-context" /> Context</div>
            <div><span className="dot dot-shared" /> Shared</div>
          </div>
        </section>
      </div>
    </aside>
  );
}
