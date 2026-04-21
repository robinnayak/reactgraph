import { useMemo } from "react";
import type { Edge, ImpactResult } from "../types";

export function useImpactAnalysis(selectedNodeId: string | null, edges: Edge[]): ImpactResult {
  return useMemo(() => {
    if (!selectedNodeId) {
      return { affected: [], indirect: [] };
    }

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const next = adjacency.get(edge.source) ?? [];
      next.push(edge.target);
      adjacency.set(edge.source, next);
    }

    const queue: Array<{ id: string; depth: number }> = [{ id: selectedNodeId, depth: 0 }];
    const seen = new Set<string>([selectedNodeId]);
    const affected = new Set<string>();
    const indirect = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current.id) ?? []) {
        if (seen.has(next)) {
          continue;
        }
        seen.add(next);
        if (current.depth === 0) {
          affected.add(next);
        } else {
          indirect.add(next);
        }
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }

    return { affected: Array.from(affected), indirect: Array.from(indirect) };
  }, [edges, selectedNodeId]);
}
