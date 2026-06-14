/**
 * Dependency-graph utilities shared by the orchestrators.
 *
 * Services declare `dependsOn`; this module produces a deterministic start order
 * (topological sort) and detects cycles so a deploy can fail fast with a clear
 * {@link DependencyCycleError}.
 */

import { DependencyCycleError } from "./errors.js";
import type { ServicePlan } from "./types.js";

/**
 * Compute a stable topological start order for the given services.
 *
 * Dependencies (`dependsOn`) start before their dependents. Among services with
 * no remaining unmet dependencies, the original declaration order is preserved
 * (Kahn's algorithm with a stable ready-queue) so output is deterministic.
 *
 * Unknown dependency names are ignored (treated as already-satisfied), which is
 * the lenient behaviour compose itself uses for cross-file references.
 *
 * @throws {@link DependencyCycleError} when a cycle is present.
 */
export function topologicalOrder(services: ServicePlan[]): ServicePlan[] {
  const byName = new Map<string, ServicePlan>();
  for (const svc of services) byName.set(svc.name, svc);

  // Build adjacency + in-degree, ignoring references to unknown services.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const svc of services) {
    indegree.set(svc.name, 0);
    dependents.set(svc.name, []);
  }
  for (const svc of services) {
    const deps = svc.dependsOn.filter((d) => byName.has(d));
    indegree.set(svc.name, deps.length);
    for (const dep of deps) {
      dependents.get(dep)!.push(svc.name);
    }
  }

  // Ready queue seeded in declaration order for determinism.
  const ready: string[] = services.filter((s) => (indegree.get(s.name) ?? 0) === 0).map((s) => s.name);
  const ordered: ServicePlan[] = [];
  const seen = new Set<string>();

  while (ready.length > 0) {
    const name = ready.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    ordered.push(byName.get(name)!);
    for (const dependent of dependents.get(name) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }

  if (ordered.length !== services.length) {
    throw new DependencyCycleError(findCycle(services, byName));
  }
  return ordered;
}

/**
 * Find one concrete dependency cycle to include in the error message. Uses an
 * iterative DFS so it is safe for large graphs.
 */
function findCycle(services: ServicePlan[], byName: Map<string, ServicePlan>): string[] {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const parent = new Map<string, string | undefined>();
  for (const svc of services) color.set(svc.name, WHITE);

  for (const start of services) {
    if (color.get(start.name) !== WHITE) continue;
    const stack: string[] = [start.name];
    parent.set(start.name, undefined);
    while (stack.length > 0) {
      const node = stack[stack.length - 1]!;
      if (color.get(node) === WHITE) color.set(node, GRAY);
      let advanced = false;
      const deps = (byName.get(node)?.dependsOn ?? []).filter((d) => byName.has(d));
      for (const dep of deps) {
        const c = color.get(dep);
        if (c === WHITE) {
          parent.set(dep, node);
          stack.push(dep);
          advanced = true;
          break;
        }
        if (c === GRAY) {
          // Reconstruct cycle dep -> ... -> node -> dep.
          const cycle: string[] = [dep];
          let cur: string | undefined = node;
          while (cur && cur !== dep) {
            cycle.push(cur);
            cur = parent.get(cur);
          }
          cycle.push(dep);
          return cycle.reverse();
        }
      }
      if (!advanced) {
        color.set(node, BLACK);
        stack.pop();
      }
    }
  }
  // Fallback: should not happen if caller already detected an incomplete sort.
  return services.map((s) => s.name);
}
