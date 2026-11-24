"use client";

import { AlertTriangle, CheckCircle2, Clock, Circle, Award, BookOpen, ShieldCheck } from "lucide-react";
import type { Course, DegreeAuditReport, ManualCredits, NamedOptionId } from "@/types/curriculum";

interface RequirementsViewProps {
  audit: DegreeAuditReport;
  coursesById: Map<string, Course>;
  manualCredits: ManualCredits;
  selectedOption: NamedOptionId;
  onUpdateManual: (patch: Partial<ManualCredits>) => void;
  onSelectOption: (opt: NamedOptionId) => void;
  onInspectCourse: (courseId: string) => void;
}

export function RequirementsView({
  audit,
  coursesById,
  manualCredits,
  selectedOption,
  onUpdateManual,
  onSelectOption,
  onInspectCourse,
}: RequirementsViewProps) {
  const pct = Math.min(100, Math.round((audit.totalCompletedCredits / audit.requiredTotalCredits) * 100));
  const plannedPct = Math.min(100, Math.round((audit.totalPlannedCredits / audit.requiredTotalCredits) * 100));

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Top Progress Summary */}
      <section
        aria-labelledby="audit-summary-heading"
        className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="audit-summary-heading" className="text-xl font-bold tracking-tight">
              Electrical Engineering, BS — Graduation Audit (2026–2027)
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Minimum <strong>120 degree credits</strong> required across Mathematics, Science, EE
              Core, EE Advanced Electives (3 of 6 areas + 2 labs + capstone), Professional
              Electives, Communication Skills, Liberal Studies, and Free Elective.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="audit-named-option" className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
              Named Option:
            </label>
            <select
              id="audit-named-option"
              value={selectedOption}
              onChange={(e) => onSelectOption(e.target.value as NamedOptionId)}
              className="rounded-md border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--text)",
              }}
            >
              <option value="standard">Standard Electrical Engineering BS</option>
              <option value="ml_ds">Machine Learning &amp; Data Science Option</option>
              <option value="semiconductor">Semiconductor Engineering Option</option>
            </select>
          </div>
        </div>

        {/* Credit Meter */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              <strong className="text-lg">{audit.totalCompletedCredits}</strong> completed
              {audit.totalInProgressCredits > 0 && (
                <span style={{ color: "var(--prog)" }}>
                  {" "}
                  + {audit.totalInProgressCredits} in progress ({audit.totalPlannedCredits} total)
                </span>
              )}{" "}
              / 120 credits
            </span>
            <span className="font-mono text-xs font-bold">{pct}%</span>
          </div>

          <div
            className="h-3 w-full rounded-full overflow-hidden relative"
            style={{ backgroundColor: "var(--surface-muted)" }}
            role="progressbar"
            aria-valuenow={audit.totalCompletedCredits}
            aria-valuemin={0}
            aria-valuemax={120}
            aria-label="Degree credit completion"
          >
            <div
              className="h-full absolute left-0 top-0 transition-all"
              style={{ width: `${plannedPct}%`, backgroundColor: "var(--prog)", opacity: 0.45 }}
            />
            <div
              className="h-full absolute left-0 top-0 transition-all"
              style={{ width: `${pct}%`, backgroundColor: "var(--ok)" }}
            />
          </div>
        </div>

        {/* Warnings */}
        {audit.warnings.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border p-3 text-xs space-y-1"
            style={{ borderColor: "var(--warn)", backgroundColor: "var(--warn-bg)" }}
          >
            {audit.warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--warn)" }} aria-hidden="true" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Named Option Section if selected */}
      {audit.namedOptionSection && (
        <SectionCard
          section={audit.namedOptionSection}
          coursesById={coursesById}
          onInspectCourse={onInspectCourse}
          highlight
        />
      )}

      {/* Requirement Bucket Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {audit.sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            coursesById={coursesById}
            onInspectCourse={onInspectCourse}
          />
        ))}
      </div>

      {/* Interactive Non-Course / GenEd & Placement Inputs */}
      <section
        aria-labelledby="manual-credits-heading"
        className="rounded-xl border p-5 space-y-4"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <h2 id="manual-credits-heading" className="text-base font-bold">
            General Education, Liberal Studies &amp; Placement Credits
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Liberal Studies, Free Electives, and external transfer/business credits can be chosen
            from hundreds of UW–Madison courses—track those credit counts and university checkboxes
            here.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <label htmlFor="manual-lib-studies" className="block text-xs font-semibold mb-1">
              Liberal Studies Credits (req: 15)
            </label>
            <input
              id="manual-lib-studies"
              type="number"
              min={0}
              max={30}
              value={manualCredits.liberalStudies}
              onChange={(e) =>
                onUpdateManual({ liberalStudies: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            />
          </div>

          <div>
            <label htmlFor="manual-free-elec" className="block text-xs font-semibold mb-1">
              Free Elective Credits (req: 1)
            </label>
            <input
              id="manual-free-elec"
              type="number"
              min={0}
              max={20}
              value={manualCredits.freeElective}
              onChange={(e) =>
                onUpdateManual({ freeElective: Math.max(0, Number(e.target.value) || 0) })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            />
          </div>

          <div>
            <label htmlFor="manual-prof-elec" className="block text-xs font-semibold mb-1">
              Other Prof. Electives (e.g. 300+ Bus/Engr)
            </label>
            <input
              id="manual-prof-elec"
              type="number"
              min={0}
              max={20}
              value={manualCredits.additionalProfElective}
              onChange={(e) =>
                onUpdateManual({
                  additionalProfElective: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            />
          </div>

          <div>
            <label htmlFor="manual-adv-elec" className="block text-xs font-semibold mb-1">
              Other ECE Adv. Electives (379/399/489/CS 500+)
            </label>
            <input
              id="manual-adv-elec"
              type="number"
              min={0}
              max={20}
              value={manualCredits.additionalAdvElective}
              onChange={(e) =>
                onUpdateManual({
                  additionalAdvElective: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs pt-2">
          {(
            [
              ["placedOutCommA", "Placed out of Comm A (Engr Comm 1)"],
              ["placedOutQrA", "Placed out of Quantitative Reasoning A"],
              ["genEdHumanities6", "≥ 6 cr Humanities / Arts / Literature"],
              ["genEdSocialSci3", "≥ 3 cr Social & Behavioral Sciences"],
              ["genEdEthnicStudies3", "≥ 3 cr Ethnic Studies"],
              ["genEdCivics3", "3 cr Civics & Perspectives (2026+ Core GenEd)"],
              ["residency30", "30 credits in residence at UW–Madison"],
              ["languageReq", "Language requirement (2 HS units or 2nd-sem course)"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
            >
              <input
                type="checkbox"
                checked={manualCredits[key]}
                onChange={(e) => onUpdateManual({ [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* University, Progression & Honors Reference Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article
          className="rounded-xl border p-4 space-y-2 text-xs"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <BookOpen className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            University Core GenEd (Summer 2026+)
          </div>
          <ul className="list-disc pl-4 space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>30 total Core GenEd credits; 120 minimum degree credits.</li>
            <li>3 cr Civics &amp; Perspectives; 6 cr Communication &amp; Literacy.</li>
            <li>6 cr Humanities &amp; Arts; 6 cr Math &amp; Quantitative Reasoning.</li>
            <li>6 cr Natural Science &amp; Wellness (including 1 lab course).</li>
            <li>3 cr Social &amp; Behavioral Science; 30 credits in residence.</li>
          </ul>
        </article>

        <article
          className="rounded-xl border p-4 space-y-2 text-xs"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            CoE Progression &amp; Transfer
          </div>
          <ul className="list-disc pl-4 space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>
              Direct-admit first-year students must meet 1st-year progression requirements.
            </li>
            <li>
              Cross-campus transfer: max 2 applications, ≤ 72 credits at application, 24 graded
              UW-Madison credits (incl. 12-cr full-time term), ≥ 2.500 Core GPA.
            </li>
            <li>
              4 Foundational Courses: 2 Math (221+, through MATH 222) + 2 Engineering Foundation
              (CHEM 104+ or PHYSICS 201/EMA 201+, plus CS/Physics/Stats/EMA).
            </li>
          </ul>
        </article>

        <article
          className="rounded-xl border p-4 space-y-2 text-xs"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 font-bold text-sm">
            <Award className="w-4 h-4" style={{ color: "var(--accent)" }} aria-hidden="true" />
            Honors in Research Program
          </div>
          <ul className="list-disc pl-4 space-y-1" style={{ color: "var(--text-muted)" }}>
            <li>Admission: ≥ 1 semester at UW-Madison, ≥ 3.5 cumulative GPA, ECE faculty advisor.</li>
            <li>Complete at least 6 credits of E C E 489 (including 3-cr thesis) with grade ≥ B.</li>
            <li>Graduate with ≥ 3.3 cumulative GPA and all EE BS degree requirements.</li>
            <li>Up to 6 credits of E C E 489 count toward EE Advanced Electives.</li>
          </ul>
        </article>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  coursesById,
  onInspectCourse,
  highlight = false,
}: {
  section: DegreeAuditReport["sections"][number];
  coursesById: Map<string, Course>;
  onInspectCourse: (id: string) => void;
  highlight?: boolean;
}) {
  return (
    <article
      className="rounded-xl border p-4 space-y-3"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: highlight ? "var(--accent)" : section.satisfied ? "var(--ok)" : "var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-base">{section.title}</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {section.summary}
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0"
          style={{
            backgroundColor: section.satisfied
              ? "var(--ok-bg)"
              : section.inProgressSatisfied
                ? "var(--prog-bg)"
                : "var(--surface-muted)",
            color: section.satisfied
              ? "var(--ok)"
              : section.inProgressSatisfied
                ? "var(--prog)"
                : "var(--text-muted)",
          }}
        >
          {section.satisfied
            ? "Complete"
            : section.inProgressSatisfied
              ? "On Track"
              : "In Progress"}
        </span>
      </div>

      <ul className="space-y-1.5 text-xs">
        {section.rules.map((rule) => (
          <li
            key={rule.id}
            className="flex items-start justify-between gap-2 rounded-md px-2.5 py-1.5"
            style={{ backgroundColor: "var(--surface-muted)" }}
          >
            <span className="flex items-start gap-2">
              {rule.satisfied ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--ok)" }} aria-hidden="true" />
              ) : rule.inProgressSatisfied ? (
                <Clock className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--prog)" }} aria-hidden="true" />
              ) : (
                <Circle className="w-4 h-4 shrink-0 mt-0.5 opacity-50" aria-hidden="true" />
              )}
              <span>{rule.label}</span>
            </span>
            <span
              className="font-mono text-[11px] shrink-0 text-right"
              style={{ color: rule.satisfied ? "var(--ok)" : "var(--text-muted)" }}
            >
              {rule.detail}
            </span>
          </li>
        ))}
      </ul>

      {section.matchedCourses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {section.matchedCourses.map((id) => {
            const c = coursesById.get(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onInspectCourse(id)}
                title={c?.title || id}
                className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded border hover:opacity-80"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg)" }}
              >
                {id}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}
