import { useMemo } from "react";
import type { Edge, ImpactResult } from "../types";

export function useImpactAnalysis(selectedNodeId: string | null, edges: Edge[]): ImpactResult {
  return useMemo(() => {
    if (!selectedNodeId) {
      return { affected: [], indirect: [] };
    }

    const reverseAdjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const dependents = reverseAdjacency.get(edge.target) ?? [];
      dependents.push(edge.source);
      reverseAdjacency.set(edge.target, dependents);
    }

    const queue: Array<{ id: string; depth: number }> = [{ id: selectedNodeId, depth: 0 }];
    const seen = new Set<string>([selectedNodeId]);
    const affected = new Set<string>();
    const indirect = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const dependent of reverseAdjacency.get(current.id) ?? []) {
        if (seen.has(dependent)) {
          continue;
        }
        seen.add(dependent);
        if (current.depth === 0) {
          affected.add(dependent);
        } else {
          indirect.add(dependent);
        }
        queue.push({ id: dependent, depth: current.depth + 1 });
      }
    }

    return { affected: Array.from(affected), indirect: Array.from(indirect) };
  }, [edges, selectedNodeId]);
}
