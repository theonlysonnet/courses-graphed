"use client";

import { Check, Clock, ArrowUpRight } from "lucide-react";
import type { Course, SampleSemester } from "@/types/curriculum";

interface FourYearPlanViewProps {
  samplePlan: SampleSemester[];
  coursesById: Map<string, Course>;
  completedIds: Set<string>;
  inProgressIds: Set<string>;
  onInspectCourse: (courseId: string) => void;
}

export function FourYearPlanView({
  samplePlan,
  coursesById,
  completedIds,
  inProgressIds,
  onInspectCourse,
}: FourYearPlanViewProps) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h2 className="text-xl font-bold tracking-tight">
          Official Sample Four-Year Plan (120 Credits)
        </h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Recommended 8-semester progression from the UW–Madison 2026–2027 Guide. Click any named
          course to inspect its prerequisites and unlock tree in the Dependency Graph.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {samplePlan.map((sem) => (
          <section
            key={sem.semester}
            aria-labelledby={`sem-heading-${sem.semester}`}
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div
              className="px-4 py-2.5 border-b flex items-center justify-between"
              style={{ backgroundColor: "var(--surface-muted)", borderColor: "var(--border)" }}
            >
              <h3 id={`sem-heading-${sem.semester}`} className="font-bold text-sm">
                Year {sem.year} — {sem.term}
              </h3>
              <span className="font-mono text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                {sem.totalCredits} credits
              </span>
            </div>

            <ul className="divide-y text-sm" style={{ borderColor: "var(--border)" }}>
              {sem.items.map((item, idx) => {
                const c = item.courseId ? coursesById.get(item.courseId) : undefined;
                const isDone = item.courseId ? completedIds.has(item.courseId) : false;
                const isProg = item.courseId ? inProgressIds.has(item.courseId) : false;

                return (
                  <li
                    key={idx}
                    className="px-4 py-2.5 flex items-center justify-between gap-3"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      {isDone && (
                        <Check className="w-4 h-4 shrink-0" style={{ color: "var(--ok)" }} aria-hidden="true" />
                      )}
                      {isProg && (
                        <Clock className="w-4 h-4 shrink-0" style={{ color: "var(--prog)" }} aria-hidden="true" />
                      )}
                      {c ? (
                        <button
                          type="button"
                          onClick={() => onInspectCourse(c.id)}
                          className="text-left hover:underline inline-flex items-center gap-1 min-w-0"
                        >
                          <span className="font-mono font-semibold text-xs shrink-0" style={{ color: "var(--accent)" }}>
                            {c.id}
                          </span>
                          <span className="truncate text-xs">{c.title}</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-xs">
                          {item.label}
                          {item.altCourseIds && item.altCourseIds.length > 0 && (
                            <span className="ml-2 inline-flex flex-wrap gap-1">
                              {item.altCourseIds.map((alt) => (
                                <button
                                  key={alt}
                                  type="button"
                                  onClick={() => onInspectCourse(alt)}
                                  className="font-mono text-[11px] underline opacity-80 hover:opacity-100"
                                >
                                  {alt}
                                </button>
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs shrink-0" style={{ color: "var(--text-muted)" }}>
                      {item.credits || "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
