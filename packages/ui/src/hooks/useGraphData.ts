import { useEffect, useState } from "react";
import type { GraphData } from "../types";

declare global {
  interface Window {
    __REACTGRAPH_DATA__?: GraphData | null;
  }
}

const fallbackData: GraphData = {
  pages: [
    { id: "page:pages/dashboard-tsx", name: "DashboardPage", filePath: "pages/dashboard.tsx", type: "page" }
  ],
  components: [
    {
      id: "component:components/navbar-tsx",
      name: "Navbar",
      filePath: "components/Navbar.tsx",
      type: "component",
      props: [
        { name: "user", type: "User", required: true },
        { name: "onLogout", type: "() => void", required: true }
      ],
      isShared: true,
      usedInPages: ["page:pages/dashboard-tsx"]
    },
    {
      id: "component:components/dashboardlayout-tsx",
      name: "DashboardLayout",
      filePath: "components/DashboardLayout.tsx",
      type: "component",
      props: [{ name: "children", type: "ReactNode", required: true }],
      isShared: false,
      usedInPages: ["page:pages/dashboard-tsx"]
    },
    {
      id: "component:components/statswidget-tsx",
      name: "StatsWidget",
      filePath: "components/StatsWidget.tsx",
      type: "component",
      props: [{ name: "initialData", type: "Metrics[]", required: true }],
      isShared: false,
      usedInPages: ["page:pages/dashboard-tsx"]
    },
    {
      id: "component:components/sidemenu-tsx",
      name: "SideMenu",
      filePath: "components/SideMenu.tsx",
      type: "component",
      props: [{ name: "activeKey", type: "string", required: true }],
      isShared: false,
      usedInPages: []
    },
    {
      id: "component:components/contentarea-tsx",
      name: "ContentArea",
      filePath: "components/ContentArea.tsx",
      type: "component",
      props: [{ name: "maxWidth", type: "number", required: false }],
      isShared: false,
      usedInPages: []
    },
    {
      id: "component:components/chartcomponent-tsx",
      name: "ChartComponent",
      filePath: "components/ChartComponent.tsx",
      type: "component",
      props: [{ name: "data", type: "any[]", required: true }],
      isShared: false,
      usedInPages: []
    }
  ],
  hooks: [
    {
      id: "hook:hooks/usetheme-ts",
      name: "useTheme",
      filePath: "hooks/useTheme.ts",
      type: "hook",
      params: [{ name: "default", type: "'dark' | 'light'" }],
      returns: [{ name: "theme", type: "string" }]
    },
    {
      id: "hook:hooks/usemetrics-ts",
      name: "useMetrics",
      filePath: "hooks/useMetrics.ts",
      type: "hook",
      params: [{ name: "pollInterval", type: "number" }],
      returns: [
        { name: "data", type: "Metrics[]" },
        { name: "isLoading", type: "boolean" },
        { name: "error", type: "Error | null" },
        { name: "refetch", type: "Function" }
      ]
    }
  ],
  apis: [
    { id: "api:get-/api/theme", endpoint: "/api/theme", method: "GET", type: "api" },
    { id: "api:get-/api/metrics", endpoint: "/api/metrics", method: "GET", type: "api" }
  ],
  edges: [
    {
      id: "edge:dashboard-navbar",
      source: "page:pages/dashboard-tsx",
      target: "component:components/navbar-tsx",
      relationshipType: "renders",
      props: [
        { name: "user", type: "User", required: true },
        { name: "onLogout", type: "() => void", required: true }
      ]
    },
    {
      id: "edge:dashboard-layout",
      source: "page:pages/dashboard-tsx",
      target: "component:components/dashboardlayout-tsx",
      relationshipType: "renders",
      props: [{ name: "children", type: "ReactNode", required: true }]
    },
    {
      id: "edge:dashboard-widget",
      source: "page:pages/dashboard-tsx",
      target: "component:components/statswidget-tsx",
      relationshipType: "renders",
      props: [{ name: "initialData", type: "Metrics[]", required: true }]
    },
    {
      id: "edge:layout-sidemenu",
      source: "component:components/dashboardlayout-tsx",
      target: "component:components/sidemenu-tsx",
      relationshipType: "renders",
      props: [{ name: "activeKey", type: "string", required: true }]
    },
    {
      id: "edge:layout-content",
      source: "component:components/dashboardlayout-tsx",
      target: "component:components/contentarea-tsx",
      relationshipType: "renders",
      props: [{ name: "maxWidth", type: "number", required: false }]
    },
    {
      id: "edge:widget-hook",
      source: "component:components/statswidget-tsx",
      target: "hook:hooks/usemetrics-ts",
      relationshipType: "uses"
    },
    {
      id: "edge:content-theme",
      source: "component:components/contentarea-tsx",
      target: "hook:hooks/usetheme-ts",
      relationshipType: "uses"
    },
    {
      id: "edge:widget-chart",
      source: "component:components/statswidget-tsx",
      target: "component:components/chartcomponent-tsx",
      relationshipType: "renders",
      props: [{ name: "data", type: "any[]", required: true }]
    },
    {
      id: "edge:metrics-api",
      source: "hook:hooks/usemetrics-ts",
      target: "api:get-/api/metrics",
      relationshipType: "calls"
    },
    {
      id: "edge:theme-api",
      source: "hook:hooks/usetheme-ts",
      target: "api:get-/api/theme",
      relationshipType: "calls"
    },
    {
      id: "edge:auth-context",
      source: "component:components/navbar-tsx",
      target: "context:authcontext",
      relationshipType: "provides"
    }
  ]
};

export function useGraphData() {
  const [data, setData] = useState<GraphData>(fallbackData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (window.__REACTGRAPH_DATA__) {
          if (!cancelled) {
            setData(window.__REACTGRAPH_DATA__);
            setLoading(false);
          }
          return;
        }

        const response = await fetch("/api/graph").catch(() => fetch("/reactgraph.json"));
        if (!response.ok) {
          throw new Error(`Unable to load graph data (${response.status})`);
        }
        const json = (await response.json()) as GraphData;
        if (!cancelled) {
          setData(json);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unknown graph loading error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
