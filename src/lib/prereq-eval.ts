import type {
  AvailabilityStatus,
  Course,
  CourseEdge,
  PrereqNode,
} from "@/types/curriculum";

export interface PlacementFlags {
  placedOutCommA?: boolean;
  placedOutQrA?: boolean;
}

export interface PrereqEvalResult {
  satisfied: boolean;
  reason?: string;
}

/**
 * Evaluate a course's structured prerequisite AST against completed and in-progress sets.
 * Concurrent-allowed leaves (`concurrent: true`) are satisfied by either completed OR in-progress.
 */
export function evaluatePrereqAst(
  node: PrereqNode | null,
  completedSet: Set<string>,
  inProgressSet: Set<string>,
  _placementFlags: PlacementFlags = {}
): PrereqEvalResult {
  if (!node) {
    return { satisfied: true };
  }

  if (node.type === "course") {
    if (completedSet.has(node.code)) {
      return { satisfied: true };
    }
    if (node.concurrent && inProgressSet.has(node.code)) {
      return { satisfied: true };
    }
    return {
      satisfied: false,
      reason: node.concurrent
        ? `Requires ${node.code} (or concurrent enrollment)`
        : `Requires ${node.code}`,
    };
  }

  if (node.type === "and") {
    const missing: string[] = [];
    for (const child of node.items) {
      const res = evaluatePrereqAst(child, completedSet, inProgressSet, _placementFlags);
      if (!res.satisfied && res.reason) {
        missing.push(res.reason);
      } else if (!res.satisfied) {
        return { satisfied: false };
      }
    }
    if (missing.length > 0) {
      return { satisfied: false, reason: missing.join("; ") };
    }
    return { satisfied: true };
  }

  // OR node
  const options: string[] = [];
  for (const child of node.items) {
    const res = evaluatePrereqAst(child, completedSet, inProgressSet, _placementFlags);
    if (res.satisfied) {
      return { satisfied: true };
    }
    if (child.type === "course") {
      options.push(child.concurrent ? `${child.code} (or concurrent)` : child.code);
    }
  }
  return {
    satisfied: false,
    reason:
      options.length > 0
        ? `Needs one of: ${options.slice(0, 4).join(" / ")}${options.length > 4 ? ` (+${options.length - 4} more)` : ""}`
        : "Missing prerequisite option",
  };
}

/**
 * Evaluate whether a single AST leaf/subtree is satisfied (used by inspector UI chips).
 */
export function isPrereqNodeSatisfied(
  node: PrereqNode,
  completedSet: Set<string>,
  inProgressSet: Set<string>
): boolean {
  return evaluatePrereqAst(node, completedSet, inProgressSet).satisfied;
}

export function getCourseAvailability(
  course: Course,
  completedSet: Set<string>,
  inProgressSet: Set<string>,
  placementFlags: PlacementFlags = {}
): AvailabilityStatus {
  if (completedSet.has(course.id)) return "completed";
  if (inProgressSet.has(course.id)) return "in_progress";
  const res = evaluatePrereqAst(course.prereqAst, completedSet, inProgressSet, placementFlags);
  return res.satisfied ? "available" : "locked";
}

export function getTransitiveAncestors(courseId: string, edges: CourseEdge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    if (!incoming.has(e.target)) incoming.set(e.target, []);
    incoming.get(e.target)!.push(e.source);
  }
  const visited = new Set<string>();
  const queue = [...(incoming.get(courseId) || [])];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === courseId || visited.has(cur)) continue;
    visited.add(cur);
    for (const prev of incoming.get(cur) || []) {
      if (!visited.has(prev)) queue.push(prev);
    }
  }
  return visited;
}

export function getTransitiveDescendants(courseId: string, edges: CourseEdge[]): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e.target);
  }
  const visited = new Set<string>();
  const queue = [...(outgoing.get(courseId) || [])];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === courseId || visited.has(cur)) continue;
    visited.add(cur);
    for (const nxt of outgoing.get(cur) || []) {
      if (!visited.has(nxt)) queue.push(nxt);
    }
  }
  return visited;
}
