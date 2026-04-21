import { useMemo } from "react";
import type { GraphNodeRecord } from "../types";

export function useSearch<T extends GraphNodeRecord>(nodes: T[], query: string): T[] {
  return useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return nodes;
    }
    return nodes.filter((node) => {
      const haystack = [node.name, node.filePath, node.type].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [nodes, query]);
}
