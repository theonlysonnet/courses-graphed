import dagre from "@dagrejs/dagre";
import type { Course, CourseEdge } from "@/types/curriculum";

export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 86;

export interface LayoutNodePosition {
  id: string;
  x: number;
  y: number;
  semester?: number;
}

export interface SwimlaneHeader {
  semester: number;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computes layered DAG coordinates via Dagre for LR or TB orientation.
 */
export function buildDagreGraph(
  visibleCourses: Course[],
  visibleEdges: CourseEdge[],
  direction: "LR" | "TB"
): Map<string, LayoutNodePosition> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    ranksep: direction === "LR" ? 96 : 74,
    nodesep: direction === "LR" ? 24 : 32,
    edgesep: 14,
    marginx: 32,
    marginy: 32,
  });

  const visibleIds = new Set(visibleCourses.map((c) => c.id));
  for (const c of visibleCourses) {
    g.setNode(c.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const e of visibleEdges) {
    if (visibleIds.has(e.source) && visibleIds.has(e.target) && e.source !== e.target) {
      g.setEdge(e.source, e.target);
    }
  }

  dagre.layout(g);

  const positions = new Map<string, LayoutNodePosition>();
  for (const c of visibleCourses) {
    const n = g.node(c.id);
    if (n) {
      positions.set(c.id, {
        id: c.id,
        x: n.x - NODE_WIDTH / 2,
        y: n.y - NODE_HEIGHT / 2,
      });
    }
  }
  return positions;
}

/**
 * Computes 8-column 4-Year Plan swimlane layout (Y1 Fall -> Y4 Spring),
 * placing courses without a sample semester in an Extra/Electives column at the end.
 */
export function buildFourYearSwimlaneGraph(
  visibleCourses: Course[]
): { positions: Map<string, LayoutNodePosition>; lanes: SwimlaneHeader[] } {
  const buckets = new Map<number, Course[]>();
  for (let s = 1; s <= 9; s++) buckets.set(s, []);

  for (const c of visibleCourses) {
    const sem =
      c.sampleSemesters.length > 0
        ? c.sampleSemesters[0]
        : inferFallbackSemester(c);
    buckets.get(sem)!.push(c);
  }

  const colWidth = NODE_WIDTH + 56;
  const rowHeight = NODE_HEIGHT + 24;
  const headerHeight = 44;
  const startX = 24;
  const startY = 24;

  const positions = new Map<string, LayoutNodePosition>();
  const lanes: SwimlaneHeader[] = [];

  const semLabels: Record<number, string> = {
    1: "Year 1 • Fall",
    2: "Year 1 • Spring",
    3: "Year 2 • Fall",
    4: "Year 2 • Spring",
    5: "Year 3 • Fall",
    6: "Year 3 • Spring",
    7: "Year 4 • Fall",
    8: "Year 4 • Spring",
    9: "Electives / Alts",
  };

  let maxRows = 1;
  for (const list of buckets.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
    if (list.length > maxRows) maxRows = list.length;
  }

  let activeCol = 0;
  for (let s = 1; s <= 9; s++) {
    const list = buckets.get(s)!;
    if (s === 9 && list.length === 0) continue;
    const x = startX + activeCol * colWidth;
    lanes.push({
      semester: s,
      label: semLabels[s],
      x,
      y: startY,
      width: NODE_WIDTH + 20,
      height: headerHeight + maxRows * rowHeight + 16,
    });
    list.forEach((c, idx) => {
      positions.set(c.id, {
        id: c.id,
        x: x + 10,
        y: startY + headerHeight + 14 + idx * rowHeight,
        semester: s,
      });
    });
    activeCol++;
  }

  return { positions, lanes };
}

function inferFallbackSemester(c: Course): number {
  if (c.isExternalPrereq) return 1;
  if (c.primaryCategory === "math" || c.primaryCategory === "science" || c.primaryCategory === "comm") {
    return c.id === "INTEREGR 397" ? 6 : 2;
  }
  if (c.isCapstone) return 8;
  if (c.is301to317Lab) return 6;
  if (c.is400PlusEce) return 7;
  if (c.primaryCategory === "adv_elective") return 6;
  return 9;
}
