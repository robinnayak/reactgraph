import { useEffect, useState } from "react";
import type { GraphData } from "../types";

declare global {
  interface Window {
    __REACTGRAPH_DATA__?: GraphData | null;
  }
}

function isGraphData(value: unknown): value is GraphData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return ["pages", "components", "hooks", "apis", "edges"].every((key) => Array.isArray(candidate[key]));
}

async function fetchGraphData(url: string): Promise<GraphData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Unable to load graph data from ${url} (${response.status})`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${url} but received ${contentType || "unknown content type"}`);
  }

  const json = (await response.json()) as GraphData;
  if (!isGraphData(json)) {
    throw new Error(`Invalid graph data shape from ${url}`);
  }

  return json;
}

export function useGraphData() {
  const injectedData = isGraphData(window.__REACTGRAPH_DATA__) ? window.__REACTGRAPH_DATA__ : null;
  const [data, setData] = useState<GraphData | null>(injectedData);
  const [loading, setLoading] = useState(!injectedData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (injectedData) {
        return;
      }

      try {
        let graph: GraphData;

        try {
          graph = await fetchGraphData("/api/graph");
        } catch {
          graph = await fetchGraphData("/reactgraph.json");
        }

        if (!cancelled) {
          setData(graph);
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
  }, [injectedData]);

  return { data, loading, error };
}
