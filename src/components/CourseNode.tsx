"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Check, Clock, CircleDot, Lock, Star, FlaskConical } from "lucide-react";
import type { AvailabilityStatus, Course, PrimaryCategory } from "@/types/curriculum";

export interface CourseNodeData extends Record<string, unknown> {
  course: Course;
  availability: AvailabilityStatus;
  selected: boolean;
  highlightRole: "none" | "selected" | "ancestor" | "descendant" | "dimmed";
  layoutDirection: "LR" | "TB" | "SWIMLANE";
  onCycleStatus: (courseId: string) => void;
}

export type CourseFlowNode = Node<CourseNodeData, "courseNode">;

const CATEGORY_BORDER_COLOR: Record<PrimaryCategory, string> = {
  core: "#c5050c",
  math: "#2563eb",
  science: "#0d9488",
  adv_elective: "#7c3aed",
  prof_elective: "#d97706",
  comm: "#db2777",
  named_option_extra: "#0284c7",
  external_prereq: "#64748b",
};

function CourseNodeInner({ data }: NodeProps<CourseFlowNode>) {
  const { course, availability, selected, highlightRole, layoutDirection, onCycleStatus } = data;
  const accentBorder = CATEGORY_BORDER_COLOR[course.primaryCategory] || "#64748b";
  const isVertical = layoutDirection === "TB";

  const statusMeta: Record<
    AvailabilityStatus,
    { label: string; badgeBg: string; badgeFg: string }
  > = {
    completed: {
      label: "Completed",
      badgeBg: "var(--ok-bg)",
      badgeFg: "var(--ok)",
    },
    in_progress: {
      label: "In Progress",
      badgeBg: "var(--prog-bg)",
      badgeFg: "var(--prog)",
    },
    available: {
      label: "Ready",
      badgeBg: "var(--warn-bg)",
      badgeFg: "var(--warn)",
    },
    locked: {
      label: "Locked",
      badgeBg: "var(--surface-muted)",
      badgeFg: "var(--text-muted)",
    },
  };

  const st = statusMeta[availability];

  let ringShadow = "0 1px 3px rgb(0 0 0 / 0.12)";
  let borderColor = "var(--border)";
  if (selected || highlightRole === "selected") {
    borderColor = "var(--accent)";
    ringShadow = "0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent)";
  } else if (highlightRole === "ancestor") {
    borderColor = "#d97706";
    ringShadow = "0 0 0 2px rgb(217 119 6 / 0.35)";
  } else if (highlightRole === "descendant") {
    borderColor = "#16a34a";
    ringShadow = "0 0 0 2px rgb(22 163 74 / 0.35)";
  }

  return (
    <div
      className="relative rounded-lg border transition-opacity select-none"
      style={{
        width: 224,
        minHeight: 86,
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        borderColor,
        borderLeftWidth: 5,
        borderLeftColor: accentBorder,
        boxShadow: ringShadow,
        opacity: highlightRole === "dimmed" ? 0.25 : 1,
        padding: "8px 10px",
      }}
    >
      <Handle
        type="target"
        position={isVertical ? Position.Top : Position.Left}
        style={{ background: "var(--text-muted)", width: 7, height: 7 }}
      />

      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-mono text-xs font-bold tracking-tight truncate">
              {course.id}
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "var(--surface-muted)", color: "var(--text-muted)" }}
            >
              {course.creditsLabel} cr
            </span>
          </div>
          <div
            className="text-xs font-medium leading-snug mt-0.5 line-clamp-2"
            title={course.title}
          >
            {course.title}
          </div>
        </div>

        <button
          type="button"
          className="nodrag nopan shrink-0 inline-flex items-center justify-center rounded-md w-7 h-7 border transition-transform hover:scale-105"
          style={{
            backgroundColor: st.badgeBg,
            color: st.badgeFg,
            borderColor: "transparent",
          }}
          aria-label={`Toggle status for ${course.id} (currently ${st.label})`}
          title={`Status: ${st.label} (click to cycle)`}
          onClick={(e) => {
            e.stopPropagation();
            onCycleStatus(course.id);
          }}
        >
          {availability === "completed" && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
          {availability === "in_progress" && <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
          {availability === "available" && <CircleDot className="w-3.5 h-3.5" aria-hidden="true" />}
          {availability === "locked" && <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
        </button>
      </div>

      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        {course.isCore && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
          >
            Core
          </span>
        )}
        {course.isCapstone && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-300">
            <Star className="w-2.5 h-2.5" aria-hidden="true" />
            Capstone
          </span>
        )}
        {course.isLab && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300">
            <FlaskConical className="w-2.5 h-2.5" aria-hidden="true" />
            Lab
          </span>
        )}
        {course.is400PlusEce && !course.isCapstone && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--surface-muted)", color: "var(--text-muted)" }}
          >
            400+
          </span>
        )}
        {course.isExternalPrereq && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "var(--surface-muted)", color: "var(--text-muted)" }}
          >
            Prereq
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={isVertical ? Position.Bottom : Position.Right}
        style={{ background: "var(--text-muted)", width: 7, height: 7 }}
      />
    </div>
  );
}

export const CourseNode = memo(CourseNodeInner);
