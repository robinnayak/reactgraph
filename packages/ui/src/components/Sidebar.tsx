import { useState } from "react";
import type { ComponentNode, GraphNodeRecord, PageNode } from "../types";

interface SidebarProps {
  pages: PageNode[];
  nodes: GraphNodeRecord[];
  healthNodes: GraphNodeRecord[];
  selectedPageId: string | null;
  selectedNodeId: string | null;
  onSelectPage: (pageId: string) => void;
  onNodeFocus: (nodeId: string) => void;
  onNodeSelect: (nodeId: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

interface HealthSectionConfig {
  key: "shared" | "move" | "unused" | "circular" | "propDrilling";
  title: string;
  colorClass: string;
  accentClass: string;
  items: ComponentNode[];
  icon?: string;
  getDetail?: (component: ComponentNode) => string | null;
}

function HealthSection(props: {
  accentClass: string;
  colorClass: string;
  getDetail?: (component: ComponentNode) => string | null;
  icon?: string;
  isOpen: boolean;
  items: ComponentNode[];
  onItemClick: (nodeId: string) => void;
  onToggle: () => void;
  selectedNodeId: string | null;
  title: string;
}) {
  const { accentClass, colorClass, getDetail, icon, isOpen, items, onItemClick, onToggle, selectedNodeId, title } = props;
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;

  return (
    <section className="sidebar__health-section">
      <button className="sidebar__health-header" onClick={onToggle} type="button">
        <span className={`dot ${colorClass}`} />
        <span>{title} ({items.length})</span>
        <span className="sidebar__health-chevron">{isOpen ? "−" : "+"}</span>
      </button>
      {isOpen ? (
        <div className="sidebar__section-list">
          {items.map((component) => (
            <button
              className={`sidebar__health-item${selectedNodeId === component.id ? ` is-active ${accentClass}` : ""}`}
              key={component.id}
              onClick={() => onItemClick(component.id)}
              type="button"
            >
              <span className={`dot ${colorClass}`} />
              <span className="sidebar__health-content">
                <span className="sidebar__health-row">
                  <span className="sidebar__health-name" style={ellipsisStyle} title={component.name}>
                    {component.name}
                  </span>
                  {icon ? <span className="sidebar__health-icon">{icon}</span> : null}
                </span>
                <span className="sidebar__health-path" style={ellipsisStyle} title={component.filePath}>
                  {component.filePath}
                </span>
                {getDetail?.(component) ? (
                  <span className="sidebar__health-detail" style={ellipsisStyle} title={getDetail(component) ?? undefined}>
                    {getDetail(component)}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function Sidebar({
  pages,
  nodes,
  healthNodes,
  selectedPageId,
  selectedNodeId,
  onSelectPage,
  onNodeFocus,
  onNodeSelect,
  searchQuery,
  onSearchChange
}: SidebarProps) {
  const components = nodes.filter((node) => node.type === "component");
  const hooks = nodes.filter((node) => node.type === "hook");
  const healthComponents = healthNodes.filter((node): node is ComponentNode => node.type === "component");
  const [openSections, setOpenSections] = useState({
    shared: true,
    move: true,
    unused: true,
    circular: true,
    propDrilling: true
  });
  const ellipsisStyle = {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%"
  } as const;
  const healthSections: HealthSectionConfig[] = [
    {
      key: "shared",
      title: "SHARED COMPONENTS",
      colorClass: "dot-shared",
      accentClass: "sidebar__health-item--shared",
      items: healthComponents.filter((component) => component.isShared && !component.shouldMoveToShared)
    },
    {
      key: "move",
      title: "MOVE TO SHARED",
      colorClass: "dot-move",
      accentClass: "sidebar__health-item--move",
      items: healthComponents.filter((component) => component.shouldMoveToShared),
      icon: "→"
    },
    {
      key: "unused",
      title: "UNUSED",
      colorClass: "dot-unused",
      accentClass: "sidebar__health-item--unused",
      items: healthComponents.filter((component) => component.isUnused),
      icon: "🗑"
    },
    {
      key: "circular",
      title: "CIRCULAR DEPS",
      colorClass: "dot-circular",
      accentClass: "sidebar__health-item--circular",
      items: healthComponents.filter((component) => component.hasCircularDependency)
    },
    {
      key: "propDrilling",
      title: "PROP DRILLING",
      colorClass: "dot-prop-drill",
      accentClass: "sidebar__health-item--prop-drill",
      items: healthComponents.filter((component) => component.hasPropDrilling),
      getDetail: (component) => {
        const details = component.propDrillingDetails ?? [];
        if (details.length === 0) {
          return null;
        }

        return details.map((detail) => `${detail.propName} (${detail.depth})`).join(", ");
      }
    }
  ].filter((section) => section.items.length > 0);

  const handleHealthItemClick = (nodeId: string) => {
    onNodeFocus(nodeId);
    onNodeSelect(nodeId);
  };

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
        {healthSections.length > 0 ? (
          <div className="sidebar__health">
            <div className="sidebar__health-divider" />
            <div className="sidebar__health-label">Code Health</div>
            <div className="sidebar__health-divider" />
            {healthSections.map((section) => (
              <HealthSection
                accentClass={section.accentClass}
                colorClass={section.colorClass}
                getDetail={section.getDetail}
                icon={section.icon}
                isOpen={openSections[section.key]}
                items={section.items}
                key={section.key}
                onItemClick={handleHealthItemClick}
                onToggle={() =>
                  setOpenSections((current) => ({
                    ...current,
                    [section.key]: !current[section.key]
                  }))
                }
                selectedNodeId={selectedNodeId}
                title={section.title}
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
