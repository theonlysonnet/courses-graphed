"use client";

import {
  Check,
  Clock,
  CircleOff,
  ExternalLink,
  Focus,
  X,
  AlertTriangle,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import type { Course, CourseEdge, CourseStatus, PrereqNode } from "@/types/curriculum";
import { AREA_LABELS } from "@/lib/degree-audit";
import { isPrereqNodeSatisfied } from "@/lib/prereq-eval";

interface CourseInspectorProps {
  course: Course | null;
  allCoursesById: Map<string, Course>;
  edges: CourseEdge[];
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  isolatedCourseId: string | null;
  onSetStatus: (courseId: string, status: CourseStatus) => void;
  onSelectCourse: (courseId: string) => void;
  onToggleIsolate: (courseId: string) => void;
  onClose: () => void;
}

function PrereqAstView({
  node,
  completedIds,
  inProgressIds,
  onSelectCourse,
  depth = 0,
}: {
  node: PrereqNode;
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  onSelectCourse: (id: string) => void;
  depth?: number;
}) {
  const met = isPrereqNodeSatisfied(node, completedIds, inProgressIds);

  if (node.type === "course") {
    const isDone = completedIds.has(node.code);
    const isProg = inProgressIds.has(node.code);
    return (
      <button
        type="button"
        onClick={() => onSelectCourse(node.code)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono font-semibold border transition-colors hover:opacity-90"
        style={{
          borderColor: met ? "var(--ok)" : "var(--border)",
          backgroundColor: isDone
            ? "var(--ok-bg)"
            : isProg && node.concurrent
              ? "var(--prog-bg)"
              : "var(--surface)",
          color: met ? "var(--ok)" : "var(--text)",
        }}
      >
        <span>{met ? "✓" : "•"}</span>
        <span>{node.code}</span>
        {node.concurrent && (
          <span className="font-sans text-[10px] font-normal opacity-80">(or co-req)</span>
        )}
      </button>
    );
  }

  const isOr = node.type === "or";
  return (
    <div
      className="rounded-lg p-2 border space-y-1.5"
      style={{
        borderColor: met ? "color-mix(in srgb, var(--ok) 45%, var(--border))" : "var(--border)",
        backgroundColor: depth % 2 === 0 ? "var(--surface-muted)" : "var(--surface)",
      }}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span style={{ color: met ? "var(--ok)" : "var(--text-muted)" }}>
          {isOr ? "Complete ANY ONE of:" : "Complete ALL of:"}
        </span>
        <span style={{ color: met ? "var(--ok)" : "var(--text-muted)" }}>
          {met ? "Met" : "Unmet"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {node.items.map((child, idx) => (
          <div key={idx} className={child.type === "course" ? "" : "w-full"}>
            <PrereqAstView
              node={child}
              completedIds={completedIds}
              inProgressIds={inProgressIds}
              onSelectCourse={onSelectCourse}
              depth={depth + 1}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CourseInspector({
  course,
  allCoursesById,
  edges,
  completedIds,
  inProgressIds,
  isolatedCourseId,
  onSetStatus,
  onSelectCourse,
  onToggleIsolate,
  onClose,
}: CourseInspectorProps) {
  if (!course) {
    return (
      <aside
        aria-label="Course Inspector"
        className="w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l p-5 flex flex-col justify-center items-center text-center"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <GitBranch className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Select a Course Node</h2>
        <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--text-muted)" }}>
          Click any course in the dependency graph to trace its prerequisite tree, see which
          advanced electives it unlocks, and update your progress.
        </p>
      </aside>
    );
  }

  const currentStatus: CourseStatus = completedIds.has(course.id)
    ? "completed"
    : inProgressIds.has(course.id)
      ? "in_progress"
      : "not_taken";

  const directUnlocks = edges
    .filter((e) => e.source === course.id)
    .map((e) => ({
      edge: e,
      target: allCoursesById.get(e.target),
    }))
    .filter((x): x is { edge: CourseEdge; target: Course } => Boolean(x.target))
    .sort((a, b) => a.target.id.localeCompare(b.target.id));

  const isIsolated = isolatedCourseId === course.id;
  const guideSearchUrl = `https://guide.wisc.edu/search/?P=${encodeURIComponent(course.id)}`;

  return (
    <aside
      aria-label={`Course details for ${course.id}`}
      className="scroller w-full lg:w-96 shrink-0 border-t lg:border-t-0 lg:border-l overflow-y-auto flex flex-col"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="p-4 border-b flex items-start justify-between gap-2 sticky top-0 z-10"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold" style={{ color: "var(--accent)" }}>
              {course.displayCode}
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ backgroundColor: "var(--surface-muted)", color: "var(--text-muted)" }}
            >
              {course.creditsLabel} credits
            </span>
          </div>
          <h2 className="text-base font-bold leading-snug mt-1">{course.title}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close course inspector"
          className="rounded-md p-1.5 hover:opacity-80"
          style={{ backgroundColor: "var(--surface-muted)", color: "var(--text)" }}
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-5 text-sm">
        {/* Status Selector */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Your Status
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              aria-pressed={currentStatus === "not_taken"}
              onClick={() => onSetStatus(course.id, "not_taken")}
              className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold border"
              style={{
                borderColor: currentStatus === "not_taken" ? "var(--text)" : "var(--border)",
                backgroundColor:
                  currentStatus === "not_taken" ? "var(--surface-muted)" : "transparent",
              }}
            >
              <CircleOff className="w-3.5 h-3.5" aria-hidden="true" />
              Not Taken
            </button>
            <button
              type="button"
              aria-pressed={currentStatus === "in_progress"}
              onClick={() => onSetStatus(course.id, "in_progress")}
              className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold border"
              style={{
                borderColor: currentStatus === "in_progress" ? "var(--prog)" : "var(--border)",
                backgroundColor:
                  currentStatus === "in_progress" ? "var(--prog-bg)" : "transparent",
                color: currentStatus === "in_progress" ? "var(--prog)" : "var(--text)",
              }}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              In Progress
            </button>
            <button
              type="button"
              aria-pressed={currentStatus === "completed"}
              onClick={() => onSetStatus(course.id, "completed")}
              className="inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold border"
              style={{
                borderColor: currentStatus === "completed" ? "var(--ok)" : "var(--border)",
                backgroundColor:
                  currentStatus === "completed" ? "var(--ok-bg)" : "transparent",
                color: currentStatus === "completed" ? "var(--ok)" : "var(--text)",
              }}
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              Completed
            </button>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              aria-pressed={isIsolated}
              onClick={() => onToggleIsolate(course.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border"
              style={{
                borderColor: isIsolated ? "var(--accent)" : "var(--border)",
                backgroundColor: isIsolated ? "var(--accent-soft)" : "var(--surface-muted)",
                color: isIsolated ? "var(--accent)" : "var(--text)",
              }}
            >
              <Focus className="w-3.5 h-3.5" aria-hidden="true" />
              {isIsolated ? "Exit Cone Isolation" : "Isolate Dependency Cone"}
            </button>

            <a
              href={guideSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold border hover:opacity-85"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              Guide
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        {/* Tags & Areas */}
        {(course.areas.length > 0 ||
          course.isCore ||
          course.isCapstone ||
          course.namedOptions.mlDs ||
          course.namedOptions.semiconductor) && (
          <div className="flex flex-wrap gap-1.5">
            {course.isCore && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                EE Core
              </span>
            )}
            {course.isCapstone && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300">
                ★ Capstone Design
              </span>
            )}
            {course.areas.map((a) => (
              <span
                key={a}
                className="text-xs font-medium px-2 py-0.5 rounded"
                style={{ backgroundColor: "var(--surface-muted)", color: "var(--text)" }}
              >
                {AREA_LABELS[a]}
              </span>
            ))}
            {course.namedOptions.mlDs && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">
                ML &amp; DS ({course.namedOptions.mlDs})
              </span>
            )}
            {course.namedOptions.semiconductor && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-300">
                Semiconductor ({course.namedOptions.semiconductor})
              </span>
            )}
          </div>
        )}

        {/* Prerequisite Tree */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Prerequisites
          </h3>
          {course.prereqAst ? (
            <PrereqAstView
              node={course.prereqAst}
              completedIds={completedIds}
              inProgressIds={inProgressIds}
              onSelectCourse={onSelectCourse}
            />
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              No course prerequisites.
            </p>
          )}

          {course.nonCourseReqs.length > 0 && (
            <div className="text-xs space-y-1 pt-1">
              <span className="font-semibold" style={{ color: "var(--text)" }}>
                Standing / Placement:{" "}
              </span>
              <span style={{ color: "var(--text-muted)" }}>
                {course.nonCourseReqs.join(" • ")}
              </span>
            </div>
          )}

          {course.requisitesRaw && course.requisitesRaw !== "None" && (
            <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <strong>Official wording:</strong> {course.requisitesRaw}
            </p>
          )}
        </div>

        {/* Direct Unlocks */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Directly Unlocks ({directUnlocks.length})
          </h3>
          {directUnlocks.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Terminal course in this curriculum graph.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {directUnlocks.map(({ edge, target }) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => onSelectCourse(target.id)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs border hover:opacity-85"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
                  title={target.title}
                >
                  <ArrowRight className="w-3 h-3 opacity-60" aria-hidden="true" />
                  <span className="font-mono font-semibold">{target.id}</span>
                  {edge.logic === "alternative" && (
                    <span className="text-[10px] opacity-70">(opt)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Exclusions */}
        {course.exclusionsRaw && (
          <div
            className="rounded-lg p-3 border text-xs flex items-start gap-2"
            style={{
              borderColor: "var(--warn)",
              backgroundColor: "var(--warn-bg)",
              color: "var(--text)",
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} aria-hidden="true" />
            <div>
              <div className="font-semibold">Credit Exclusion</div>
              <p className="mt-0.5">{course.exclusionsRaw}</p>
            </div>
          </div>
        )}

        {/* Description */}
        {course.description && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Description
            </h3>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
              {course.description}
            </p>
          </div>
        )}

        {/* Metadata */}
        <div className="text-xs space-y-1 pt-1 border-t" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {course.lastTaught && (
            <div>
              <strong style={{ color: "var(--text)" }}>Last Taught:</strong> {course.lastTaught}
            </div>
          )}
          {course.designations.length > 0 && (
            <div>
              <strong style={{ color: "var(--text)" }}>Designations:</strong>{" "}
              {course.designations.join(", ")}
            </div>
          )}
          {course.aliases.length > 0 && (
            <div>
              <strong style={{ color: "var(--text)" }}>Cross-listed as:</strong>{" "}
              {course.aliases.join(", ")}
            </div>
          )}
        </div>

        {/* Learning Outcomes */}
        {course.learningOutcomes.length > 0 && (
          <details className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
            <summary className="text-xs font-semibold cursor-pointer">
              Learning Outcomes ({course.learningOutcomes.length})
            </summary>
            <ol className="list-decimal pl-4 mt-2 space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {course.learningOutcomes.map((lo, i) => (
                <li key={i}>{lo}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </aside>
  );
}
