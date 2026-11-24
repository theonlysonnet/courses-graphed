"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Search,
  Maximize2,
  RotateCcw,
  Sparkles,
  Focus,
  X,
} from "lucide-react";
import type {
  AreaId,
  Course,
  CourseEdge,
  CourseStatus,
  NamedOptionId,
} from "@/types/curriculum";
import { AREA_LABELS } from "@/lib/degree-audit";
import {
  buildDagreGraph,
  buildFourYearSwimlaneGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "@/lib/graph-layout";
import {
  getCourseAvailability,
  getTransitiveAncestors,
  getTransitiveDescendants,
} from "@/lib/prereq-eval";
import { CourseNode, type CourseFlowNode } from "@/components/CourseNode";
import { CourseInspector } from "@/components/CourseInspector";

export type GraphScopePreset =
  | "core_foundations"
  | "all_curriculum"
  | "prof_electives"
  | "named_option"
  | AreaId;

type SwimlaneHeaderNodeData = {
  label: string;
  width: number;
  height: number;
};
type SwimlaneHeaderNode = Node<SwimlaneHeaderNodeData, "swimlaneHeader">;

function SwimlaneHeaderComponent({ data }: { data: SwimlaneHeaderNodeData }) {
  return (
    <div
      className="rounded-xl border pointer-events-none select-none"
      style={{
        width: data.width,
        height: data.height,
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in srgb, var(--surface-muted) 45%, transparent)",
      }}
    >
      <div
        className="px-3 py-2 text-xs font-bold uppercase tracking-wider border-b rounded-t-xl"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
          color: "var(--text)",
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

const nodeTypes = {
  courseNode: CourseNode,
  swimlaneHeader: SwimlaneHeaderComponent,
};

interface GraphViewProps {
  courses: Course[];
  edges: CourseEdge[];
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  selectedOption: NamedOptionId;
  selectedCourseId: string | null;
  onSelectCourse: (id: string | null) => void;
  onCycleStatus: (id: string) => void;
  onSetStatus: (id: string, status: CourseStatus) => void;
  onLoadDemo: () => void;
  onResetProgress: () => void;
}

function GraphCanvasInner({
  courses,
  edges,
  completedIds,
  inProgressIds,
  selectedOption,
  selectedCourseId,
  onSelectCourse,
  onCycleStatus,
  onSetStatus,
  onLoadDemo,
  onResetProgress,
}: GraphViewProps) {
  const { fitView, setCenter } = useReactFlow();

  const [scope, setScope] = useState<GraphScopePreset>("core_foundations");
  const [layoutMode, setLayoutMode] = useState<"LR" | "TB" | "SWIMLANE">("LR");
  const [showAltEdges, setShowAltEdges] = useState(true);
  const [showExternalPrereqs, setShowExternalPrereqs] = useState(false);
  const [isolatedCourseId, setIsolatedCourseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allCoursesById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Filter visible courses based on scope, external toggle, and cone isolation
  const visibleCourseSet = useMemo(() => {
    const base = new Set<string>();
    const addWithCorePrereqs = (predicate: (c: Course) => boolean) => {
      for (const c of courses) {
        if (predicate(c)) base.add(c.id);
      }
    };

    if (scope === "core_foundations") {
      // Standard core + math + science + comm (excluding alternate Physics 207/247 unless completed)
      const standardFoundations = new Set([
        "MATH 221",
        "MATH 222",
        "MATH 234",
        "STAT 311",
        "E C E 331",
        "COMP SCI 300",
        "PHYSICS 201",
        "PHYSICS 202",
        "CHEM 103",
        "CHEM 109",
        "INTEREGR 156",
        "INTEREGR 397",
      ]);
      addWithCorePrereqs(
        (c) =>
          c.isCore ||
          standardFoundations.has(c.id) ||
          ((c.primaryCategory === "math" || c.primaryCategory === "science") &&
            (completedIds.has(c.id) || inProgressIds.has(c.id)))
      );
    } else if (scope === "all_curriculum") {
      addWithCorePrereqs((c) => !c.isExternalPrereq);
    } else if (scope === "prof_electives") {
      addWithCorePrereqs(
        (c) => c.categories.includes("prof_elective") || c.isCore || c.isAdvMathAux
      );
    } else if (scope === "named_option") {
      addWithCorePrereqs((c) => {
        if (selectedOption === "ml_ds") {
          return Boolean(c.namedOptions.mlDs) || c.isCore || c.id === "MATH 234";
        }
        if (selectedOption === "semiconductor") {
          return Boolean(c.namedOptions.semiconductor) || c.isCore;
        }
        return c.isCore || c.isCapstone;
      });
    } else {
      // Specific specialty area + its prerequisite core courses
      addWithCorePrereqs(
        (c) => c.areas.includes(scope) || c.isCore || c.id === "COMP SCI 300" || c.id === "MATH 234"
      );
    }

    if (showExternalPrereqs) {
      // Include direct prerequisites of any visible course
      for (const e of edges) {
        if (base.has(e.target)) {
          base.add(e.source);
        }
      }
    }

    // Ensure selected course is visible if user jumped from table/search
    if (selectedCourseId && allCoursesById.has(selectedCourseId)) {
      base.add(selectedCourseId);
    }

    // If cone isolation is active, restrict to selected/isolated course + ancestors + descendants
    if (isolatedCourseId && allCoursesById.has(isolatedCourseId)) {
      const anc = getTransitiveAncestors(isolatedCourseId, edges);
      const desc = getTransitiveDescendants(isolatedCourseId, edges);
      const cone = new Set<string>([isolatedCourseId, ...anc, ...desc]);
      return cone;
    }

    return base;
  }, [
    scope,
    courses,
    edges,
    completedIds,
    inProgressIds,
    selectedOption,
    showExternalPrereqs,
    selectedCourseId,
    isolatedCourseId,
    allCoursesById,
  ]);

  const visibleCourses = useMemo(
    () => courses.filter((c) => visibleCourseSet.has(c.id)),
    [courses, visibleCourseSet]
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          visibleCourseSet.has(e.source) &&
          visibleCourseSet.has(e.target) &&
          (showAltEdges || e.logic === "required")
      ),
    [edges, visibleCourseSet, showAltEdges]
  );

  // Selected course ancestry/descendant sets for highlighting
  const { ancestors, descendants } = useMemo(() => {
    if (!selectedCourseId) {
      return { ancestors: new Set<string>(), descendants: new Set<string>() };
    }
    return {
      ancestors: getTransitiveAncestors(selectedCourseId, visibleEdges),
      descendants: getTransitiveDescendants(selectedCourseId, visibleEdges),
    };
  }, [selectedCourseId, visibleEdges]);

  // Compute node positions via Dagre or Swimlane
  const { flowNodes, flowEdges } = useMemo(() => {
    let positions: Map<string, { id: string; x: number; y: number }>;
    let laneNodes: SwimlaneHeaderNode[] = [];

    if (layoutMode === "SWIMLANE") {
      const swim = buildFourYearSwimlaneGraph(visibleCourses);
      positions = swim.positions;
      laneNodes = swim.lanes.map((lane) => ({
        id: `lane-${lane.semester}`,
        type: "swimlaneHeader",
        position: { x: lane.x, y: lane.y },
        data: { label: lane.label, width: lane.width, height: lane.height },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
      }));
    } else {
      positions = buildDagreGraph(visibleCourses, visibleEdges, layoutMode);
    }

    const cNodes: CourseFlowNode[] = visibleCourses.map((c) => {
      const pos = positions.get(c.id) || { x: 0, y: 0 };
      const availability = getCourseAvailability(c, completedIds, inProgressIds);

      let highlightRole: CourseFlowNode["data"]["highlightRole"] = "none";
      if (selectedCourseId) {
        if (c.id === selectedCourseId) highlightRole = "selected";
        else if (ancestors.has(c.id)) highlightRole = "ancestor";
        else if (descendants.has(c.id)) highlightRole = "descendant";
        else highlightRole = "dimmed";
      }

      return {
        id: c.id,
        type: "courseNode",
        position: { x: pos.x, y: pos.y },
        data: {
          course: c,
          availability,
          selected: c.id === selectedCourseId,
          highlightRole,
          layoutDirection: layoutMode,
          onCycleStatus,
        },
        zIndex: 2,
      };
    });

    const fEdges: Edge[] = visibleEdges.map((e) => {
      const isHighlighted =
        selectedCourseId &&
        ((e.target === selectedCourseId && ancestors.has(e.source)) ||
          (ancestors.has(e.target) && ancestors.has(e.source)) ||
          (e.source === selectedCourseId && descendants.has(e.target)) ||
          (descendants.has(e.source) && descendants.has(e.target)));

      const isAncestorEdge =
        selectedCourseId &&
        (e.target === selectedCourseId || ancestors.has(e.target)) &&
        ancestors.has(e.source);

      const isDescendantEdge =
        selectedCourseId &&
        (e.source === selectedCourseId || descendants.has(e.source)) &&
        descendants.has(e.target);

      const strokeColor = isAncestorEdge
        ? "#d97706"
        : isDescendantEdge
          ? "#16a34a"
          : e.relation === "coreq_or_prereq"
            ? "#0284c7"
            : e.logic === "alternative"
              ? "#94a3b8"
              : "#64748b";

      const strokeDasharray =
        e.relation === "coreq_or_prereq"
          ? "6 4"
          : e.logic === "alternative"
            ? "2 4"
            : undefined;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: Boolean(isHighlighted && e.relation === "coreq_or_prereq"),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: strokeColor,
        },
        style: {
          stroke: strokeColor,
          strokeWidth: isHighlighted ? 2.4 : e.logic === "required" ? 1.6 : 1.2,
          strokeDasharray,
          opacity: selectedCourseId ? (isHighlighted ? 1 : 0.14) : e.logic === "alternative" ? 0.65 : 0.9,
        },
      };
    });

    return {
      flowNodes: [...laneNodes, ...cNodes] as Node[],
      flowEdges: fEdges,
    };
  }, [
    visibleCourses,
    visibleEdges,
    layoutMode,
    completedIds,
    inProgressIds,
    selectedCourseId,
    ancestors,
    descendants,
    onCycleStatus,
  ]);

  // Fit view when scope, layout, or cone isolation changes
  useEffect(() => {
    const t = setTimeout(() => {
      fitView({ padding: 0.18, duration: 280 });
    }, 40);
    return () => clearTimeout(t);
  }, [scope, layoutMode, isolatedCourseId, fitView]);

  // Center on newly selected course if user searches or clicks inspector link
  const focusCourse = (courseId: string) => {
    onSelectCourse(courseId);
    const targetNode = flowNodes.find((n) => n.id === courseId);
    if (targetNode) {
      setCenter(
        targetNode.position.x + NODE_WIDTH / 2,
        targetNode.position.y + NODE_HEIGHT / 2,
        { zoom: 1, duration: 320 }
      );
    }
  };

  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return courses
      .filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.displayCode.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [searchQuery, courses]);

  const selectedCourse = selectedCourseId ? allCoursesById.get(selectedCourseId) ?? null : null;

  const scopeButtons: { id: GraphScopePreset; label: string }[] = [
    { id: "core_foundations", label: "Core & Foundations" },
    { id: "all_curriculum", label: "All EE Courses" },
    { id: "lab", label: "Labs" },
    { id: "circuits_devices", label: "Circuits & Devices" },
    { id: "computers_computing", label: "Computers" },
    { id: "comm_sp", label: "Comm & Signal Proc" },
    { id: "fields_waves", label: "Fields & Waves" },
    { id: "power_machines", label: "Power & Machines" },
    { id: "systems_control", label: "Systems & Control" },
    { id: "prof_electives", label: "Prof Electives" },
  ];

  if (selectedOption !== "standard") {
    scopeButtons.splice(2, 0, {
      id: "named_option",
      label: selectedOption === "ml_ds" ? "ML & Data Science Track" : "Semiconductor Track",
    });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scope & Control Toolbar */}
      <div
        className="px-4 py-2.5 border-b flex flex-col gap-2"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Top Row: Scope Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scroller">
          <span
            className="text-xs font-semibold shrink-0 mr-1"
            style={{ color: "var(--text-muted)" }}
          >
            Scope:
          </span>
          {scopeButtons.map((btn) => {
            const active = scope === btn.id && !isolatedCourseId;
            return (
              <button
                key={btn.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setIsolatedCourseId(null);
                  setScope(btn.id);
                }}
                className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold border transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  backgroundColor: active ? "var(--accent)" : "var(--surface-muted)",
                  color: active ? "var(--accent-contrast)" : "var(--text)",
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Bottom Row: Search, Layout, Edge Toggles, Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <label htmlFor="graph-course-search" className="visually-hidden">
                Jump to course in graph
              </label>
              <div className="relative flex items-center">
                <Search
                  className="w-3.5 h-3.5 absolute left-2.5 pointer-events-none"
                  style={{ color: "var(--text-muted)" }}
                  aria-hidden="true"
                />
                <input
                  id="graph-course-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Jump to course (e.g. ECE 340)..."
                  className="pl-8 pr-3 py-1 text-xs rounded-md border w-56"
                  style={{
                    borderColor: "var(--border)",
                    backgroundColor: "var(--bg)",
                    color: "var(--text)",
                  }}
                />
              </div>

              {searchMatches.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Course search results"
                  className="absolute left-0 top-full mt-1 w-72 max-h-64 overflow-y-auto rounded-lg border shadow-lg z-30"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                >
                  {searchMatches.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:opacity-80 flex items-center justify-between gap-2 border-b last:border-b-0"
                        style={{ borderColor: "var(--border)" }}
                        onClick={() => {
                          if (!visibleCourseSet.has(c.id)) {
                            setScope("all_curriculum");
                          }
                          setSearchQuery("");
                          focusCourse(c.id);
                        }}
                      >
                        <span className="truncate">
                          <strong className="font-mono">{c.id}</strong> — {c.title}
                        </span>
                        <span
                          className="text-[10px] shrink-0"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {c.creditsLabel} cr
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-1 rounded-md border p-0.5" style={{ borderColor: "var(--border)" }}>
              {(
                [
                  { id: "LR", label: "Left → Right" },
                  { id: "TB", label: "Top → Bottom" },
                  { id: "SWIMLANE", label: "4-Yr Swimlanes" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={layoutMode === m.id}
                  onClick={() => setLayoutMode(m.id)}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{
                    backgroundColor: layoutMode === m.id ? "var(--surface-muted)" : "transparent",
                    color: layoutMode === m.id ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer px-1.5">
              <input
                type="checkbox"
                checked={showAltEdges}
                onChange={(e) => setShowAltEdges(e.target.checked)}
              />
              OR-Alternative Edges
            </label>

            <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer px-1.5">
              <input
                type="checkbox"
                checked={showExternalPrereqs}
                onChange={(e) => setShowExternalPrereqs(e.target.checked)}
              />
              External Prereqs
            </label>
          </div>

          <div className="flex items-center gap-1.5">
            {isolatedCourseId && (
              <button
                type="button"
                onClick={() => setIsolatedCourseId(null)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border"
                style={{
                  borderColor: "var(--accent)",
                  backgroundColor: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <Focus className="w-3.5 h-3.5" aria-hidden="true" />
                Cone: {isolatedCourseId}
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border hover:opacity-85"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
              title="Mark Year 1 + Year 2 Fall courses completed to preview unlocked junior courses"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Sophomore Demo
            </button>

            <button
              type="button"
              onClick={onResetProgress}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border hover:opacity-85"
              style={{ borderColor: "var(--border)" }}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset
            </button>

            <button
              type="button"
              onClick={() => fitView({ padding: 0.18, duration: 280 })}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border hover:opacity-85"
              style={{ borderColor: "var(--border)" }}
              aria-label="Fit graph to view"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Canvas + Inspector */}
      <div className="flex flex-col lg:flex-none lg:flex-row lg:h-[calc(100dvh-13rem)] lg:min-h-[480px] lg:overflow-hidden">
        <div className="relative h-[520px] w-full lg:h-auto lg:self-stretch lg:w-auto lg:flex-1">
          <div
            className="absolute top-3 left-3 z-10 rounded-md px-2.5 py-1 text-xs font-medium border pointer-events-none"
            style={{
              backgroundColor: "color-mix(in srgb, var(--surface) 88%, transparent)",
              borderColor: "var(--border)",
              color: "var(--text-muted)",
            }}
          >
            Showing <strong style={{ color: "var(--text)" }}>{visibleCourses.length}</strong>{" "}
            courses &amp; <strong style={{ color: "var(--text)" }}>{visibleEdges.length}</strong>{" "}
            prerequisite edges
          </div>

          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => {
              if (node.type === "courseNode") {
                onSelectCourse(node.id);
              }
            }}
            onPaneClick={() => onSelectCourse(null)}
            minZoom={0.18}
            maxZoom={1.75}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={22} size={1} color="var(--border)" />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                if (n.type !== "courseNode") return "transparent";
                const d = n.data as CourseNodeDataLike;
                if (d.availability === "completed") return "#16a34a";
                if (d.availability === "in_progress") return "#0284c7";
                if (d.availability === "available") return "#d97706";
                return "#64748b";
              }}
            />
          </ReactFlow>
        </div>

        <CourseInspector
          course={selectedCourse}
          allCoursesById={allCoursesById}
          edges={edges}
          completedIds={completedIds}
          inProgressIds={inProgressIds}
          isolatedCourseId={isolatedCourseId}
          onSetStatus={onSetStatus}
          onSelectCourse={(id) => {
            if (!visibleCourseSet.has(id)) {
              setScope("all_curriculum");
            }
            focusCourse(id);
          }}
          onToggleIsolate={(id) =>
            setIsolatedCourseId((cur) => (cur === id ? null : id))
          }
          onClose={() => onSelectCourse(null)}
        />
      </div>
    </div>
  );
}

type CourseNodeDataLike = { availability?: string };

export function GraphView(props: GraphViewProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
