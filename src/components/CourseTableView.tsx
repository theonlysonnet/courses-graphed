"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock, CircleDot, Lock } from "lucide-react";
import type { AvailabilityStatus, Course, CourseEdge, PrimaryCategory } from "@/types/curriculum";
import { AREA_LABELS } from "@/lib/degree-audit";
import { getCourseAvailability } from "@/lib/prereq-eval";

const PRIMARY_CATEGORY_LABELS: Record<PrimaryCategory, string> = {
  core: "EE Core",
  math: "Mathematics",
  science: "Science",
  adv_elective: "Advanced Elective",
  prof_elective: "Professional Elective",
  comm: "Communication",
  named_option_extra: "Named Option",
  external_prereq: "External Prereq",
};

interface CourseTableViewProps {
  courses: Course[];
  edges: CourseEdge[];
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  onCycleStatus: (id: string) => void;
  onInspectCourse: (id: string) => void;
}

export function CourseTableView({
  courses,
  edges,
  completedIds,
  inProgressIds,
  onCycleStatus,
  onInspectCourse,
}: CourseTableViewProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("curriculum");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const unlockCountBySource = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of edges) {
      map.set(e.source, (map.get(e.source) || 0) + 1);
    }
    return map;
  }, [edges]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      if (categoryFilter === "curriculum" && c.isExternalPrereq) return false;
      if (categoryFilter === "core" && !c.isCore) return false;
      if (categoryFilter === "adv_elective" && !c.categories.includes("adv_elective")) return false;
      if (categoryFilter === "capstone" && !c.isCapstone) return false;
      if (categoryFilter === "lab" && !c.isLab) return false;

      const avail = getCourseAvailability(c, completedIds, inProgressIds);
      if (statusFilter !== "all" && avail !== statusFilter) return false;

      if (q) {
        return (
          c.id.toLowerCase().includes(q) ||
          c.displayCode.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.requisitesRaw.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [courses, query, categoryFilter, statusFilter, completedIds, inProgressIds]);

  const statusBadge = (avail: AvailabilityStatus) => {
    const styles: Record<AvailabilityStatus, { label: string; bg: string; fg: string }> = {
      completed: { label: "Completed", bg: "var(--ok-bg)", fg: "var(--ok)" },
      in_progress: { label: "In Progress", bg: "var(--prog-bg)", fg: "var(--prog)" },
      available: { label: "Ready", bg: "var(--warn-bg)", fg: "var(--warn)" },
      locked: { label: "Locked", bg: "var(--surface-muted)", fg: "var(--text-muted)" },
    };
    const s = styles[avail];
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{ backgroundColor: s.bg, color: s.fg }}
      >
        {avail === "completed" && <Check className="w-3 h-3" aria-hidden="true" />}
        {avail === "in_progress" && <Clock className="w-3 h-3" aria-hidden="true" />}
        {avail === "available" && <CircleDot className="w-3 h-3" aria-hidden="true" />}
        {avail === "locked" && <Lock className="w-3 h-3" aria-hidden="true" />}
        {s.label}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Filters */}
      <div
        className="rounded-xl border p-4 flex flex-wrap items-end gap-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex-1 min-w-52">
          <label htmlFor="table-search" className="block text-xs font-semibold mb-1">
            Search Courses
          </label>
          <input
            id="table-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Code, title, or prerequisite..."
            className="w-full rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
          />
        </div>

        <div>
          <label htmlFor="table-cat" className="block text-xs font-semibold mb-1">
            Curriculum Group
          </label>
          <select
            id="table-cat"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
          >
            <option value="curriculum">All EE BS Curriculum ({courses.filter((c) => !c.isExternalPrereq).length})</option>
            <option value="all">All Including External Prereqs ({courses.length})</option>
            <option value="core">EE Core (12)</option>
            <option value="adv_elective">EE Advanced Electives</option>
            <option value="lab">Labs</option>
            <option value="capstone">Capstones (4)</option>
          </select>
        </div>

        <div>
          <label htmlFor="table-status" className="block text-xs font-semibold mb-1">
            Availability
          </label>
          <select
            id="table-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
          >
            <option value="all">All Statuses</option>
            <option value="available">Ready to Take</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="locked">Locked</option>
          </select>
        </div>
      </div>

      {/* Accessible Semantic Table */}
      <div
        className="rounded-xl border overflow-x-auto scroller"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <table className="w-full text-left border-collapse text-sm">
          <caption className="p-3 text-left text-xs font-semibold border-b" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            UW–Madison Electrical Engineering BS Courses ({filtered.length} shown) — click status to cycle or open in graph
          </caption>
          <thead>
            <tr style={{ backgroundColor: "var(--surface-muted)" }}>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Course</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Title</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Cr</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Areas / Group</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Prerequisites</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Unlocks</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Status</th>
              <th scope="col" className="px-3 py-2.5 text-xs font-bold">Graph</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((c) => {
              const avail = getCourseAvailability(c, completedIds, inProgressIds);
              const unlocks = unlockCountBySource.get(c.id) || 0;
              return (
                <tr key={c.id} className="hover:opacity-95" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5 font-mono text-xs font-bold whitespace-nowrap">
                    {c.displayCode}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium max-w-xs">{c.title}</td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{c.creditsLabel}</td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
                    {c.isCore
                      ? "EE Core"
                      : c.areas.length > 0
                        ? c.areas.map((a) => AREA_LABELS[a]).join(", ")
                        : PRIMARY_CATEGORY_LABELS[c.primaryCategory]}
                  </td>
                  <td className="px-3 py-2.5 text-xs max-w-sm" style={{ color: "var(--text-muted)" }}>
                    {c.requisitesRaw}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-center">{unlocks}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onCycleStatus(c.id)}
                      aria-label={`Toggle status for ${c.id}`}
                    >
                      {statusBadge(avail)}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onInspectCourse(c.id)}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold border hover:opacity-80"
                      style={{ borderColor: "var(--border)" }}
                    >
                      Inspect
                      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
