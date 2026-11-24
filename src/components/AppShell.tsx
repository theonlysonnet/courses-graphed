"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GitFork,
  ClipboardCheck,
  CalendarRange,
  Table2,
  HelpCircle,
  GraduationCap,
} from "lucide-react";
import type {
  CourseStatus,
  CurriculumDataset,
  ManualCredits,
  NamedOptionId,
} from "@/types/curriculum";
import { computeDegreeAudit, DEFAULT_MANUAL_CREDITS } from "@/lib/degree-audit";
import { GraphView } from "@/components/GraphView";
import { RequirementsView } from "@/components/RequirementsView";
import { FourYearPlanView } from "@/components/FourYearPlanView";
import { CourseTableView } from "@/components/CourseTableView";
import { HelpDialog } from "@/components/HelpDialog";

type ActiveTab = "graph" | "requirements" | "plan" | "table";
type ThemePreference = "auto" | "light" | "dark";

const STORAGE_KEY = "uw-ee-bs-planner-v1";

const SOPHOMORE_DEMO_COMPLETED = [
  "MATH 221",
  "MATH 222",
  "MATH 234",
  "CHEM 109",
  "PHYSICS 201",
  "PHYSICS 202",
  "E C E 210",
  "E C E 252",
  "E C E 203",
  "INTEREGR 156",
];

const SOPHOMORE_DEMO_IN_PROGRESS = [
  "E C E 222",
  "E C E 230",
  "E C E 270",
  "COMP SCI 300",
];

interface SavedState {
  completed: string[];
  inProgress: string[];
  manual: ManualCredits;
  option: NamedOptionId;
  theme: ThemePreference;
}

export function AppShell({ dataset }: { dataset: CurriculumDataset }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("graph");
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(() => new Set());
  const [manualCredits, setManualCredits] = useState<ManualCredits>(DEFAULT_MANUAL_CREDITS);
  const [selectedOption, setSelectedOption] = useState<NamedOptionId>("standard");
  const [theme, setTheme] = useState<ThemePreference>("auto");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>("E C E 230");
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const tabRefs = useRef<Record<ActiveTab, HTMLButtonElement | null>>({
    graph: null,
    requirements: null,
    plan: null,
    table: null,
  });

  // Load saved state once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedState>;
        if (Array.isArray(parsed.completed)) setCompletedIds(new Set(parsed.completed));
        if (Array.isArray(parsed.inProgress)) setInProgressIds(new Set(parsed.inProgress));
        if (parsed.manual) setManualCredits({ ...DEFAULT_MANUAL_CREDITS, ...parsed.manual });
        if (parsed.option) setSelectedOption(parsed.option);
        if (parsed.theme) setTheme(parsed.theme);
      }
    } catch {
      // ignore invalid storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      const payload: SavedState = {
        completed: [...completedIds],
        inProgress: [...inProgressIds],
        manual: manualCredits,
        option: selectedOption,
        theme,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [hydrated, completedIds, inProgressIds, manualCredits, selectedOption, theme]);

  // Apply explicit theme override on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const coursesById = useMemo(
    () => new Map(dataset.courses.map((c) => [c.id, c])),
    [dataset.courses]
  );

  const audit = useMemo(
    () =>
      computeDegreeAudit(
        dataset.courses,
        completedIds,
        inProgressIds,
        manualCredits,
        selectedOption
      ),
    [dataset.courses, completedIds, inProgressIds, manualCredits, selectedOption]
  );

  const setCourseStatus = useCallback((courseId: string, status: CourseStatus) => {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (status === "completed") next.add(courseId);
      else next.delete(courseId);
      return next;
    });
    setInProgressIds((prev) => {
      const next = new Set(prev);
      if (status === "in_progress") next.add(courseId);
      else next.delete(courseId);
      return next;
    });
    setAnnouncement(`${courseId} marked ${status.replace("_", " ")}.`);
  }, []);

  const cycleCourseStatus = useCallback(
    (courseId: string) => {
      if (completedIds.has(courseId)) {
        setCourseStatus(courseId, "not_taken");
      } else if (inProgressIds.has(courseId)) {
        setCourseStatus(courseId, "completed");
      } else {
        setCourseStatus(courseId, "in_progress");
      }
    },
    [completedIds, inProgressIds, setCourseStatus]
  );

  const handleLoadDemo = useCallback(() => {
    setCompletedIds(new Set(SOPHOMORE_DEMO_COMPLETED));
    setInProgressIds(new Set(SOPHOMORE_DEMO_IN_PROGRESS));
    setManualCredits((prev) => ({
      ...prev,
      liberalStudies: 6,
      genEdHumanities6: true,
    }));
    setAnnouncement("Loaded Sophomore Demo progress (10 completed, 4 in progress).");
  }, []);

  const handleReset = useCallback(() => {
    setCompletedIds(new Set());
    setInProgressIds(new Set());
    setManualCredits(DEFAULT_MANUAL_CREDITS);
    setAnnouncement("Reset all course progress.");
  }, []);

  const handleInspectFromOtherTab = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    setActiveTab("graph");
  }, []);

  const tabs: { id: ActiveTab; label: string; icon: typeof GitFork }[] = [
    { id: "graph", label: "Dependency Graph", icon: GitFork },
    { id: "requirements", label: "Graduation Requirements", icon: ClipboardCheck },
    { id: "plan", label: "4-Year Sample Plan", icon: CalendarRange },
    { id: "table", label: "Course Catalog Table", icon: Table2 },
  ];

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else return;

    e.preventDefault();
    const nextTab = tabs[nextIdx].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Live Region for Screen Readers */}
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* Top Header */}
      <header
        className="border-b px-4 py-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              <GraduationCap className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight tracking-tight">
                UW–Madison Electrical Engineering, BS
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                2026–2027 Guide • {dataset.stats.curriculumCourses} curriculum courses •{" "}
                {dataset.stats.totalEdges} dependency edges
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Credit Pill */}
            <button
              type="button"
              onClick={() => setActiveTab("requirements")}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
              title="Open Graduation Requirements audit"
            >
              <span>Credits:</span>
              <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>
                {audit.totalCompletedCredits}
                {audit.totalInProgressCredits > 0 ? `+${audit.totalInProgressCredits}` : ""} / 120
              </span>
            </button>

            {/* Named Option Picker */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="header-option-select" className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Track:
              </label>
              <select
                id="header-option-select"
                value={selectedOption}
                onChange={(e) => setSelectedOption(e.target.value as NamedOptionId)}
                className="rounded-md border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg)",
                  color: "var(--text)",
                }}
              >
                <option value="standard">Standard EE BS</option>
                <option value="ml_ds">ML &amp; Data Science</option>
                <option value="semiconductor">Semiconductor Eng.</option>
              </select>
            </div>

            {/* Theme Switcher */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="header-theme-select" className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                Theme:
              </label>
              <select
                id="header-theme-select"
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemePreference)}
                className="rounded-md border px-2 py-1 text-xs font-semibold"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg)",
                  color: "var(--text)",
                }}
              >
                <option value="auto">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-muted)" }}
            >
              <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
              Legend &amp; Help
            </button>
          </div>
        </div>
      </header>

      {/* Primary View Tabs */}
      <nav aria-label="Planner sections" style={{ backgroundColor: "var(--surface)" }}>
        <div
          role="tablist"
          aria-label="Electrical Engineering planner views"
          // @ts-expect-error focusgroup is progressive enhancement
          focusgroup="tablist nomemory"
          className="app-tablist max-w-[1600px] mx-auto px-4"
        >
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[tab.id] = el;
                }}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                className="app-tab"
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col min-h-0">
        <div
          role="tabpanel"
          aria-labelledby="tab-graph"
          hidden={activeTab !== "graph"}
          className={activeTab === "graph" ? "flex-1 flex flex-col min-h-0" : ""}
        >
          <GraphView
            courses={dataset.courses}
            edges={dataset.edges}
            completedIds={completedIds}
            inProgressIds={inProgressIds}
            selectedOption={selectedOption}
            selectedCourseId={selectedCourseId}
            onSelectCourse={setSelectedCourseId}
            onCycleStatus={cycleCourseStatus}
            onSetStatus={setCourseStatus}
            onLoadDemo={handleLoadDemo}
            onResetProgress={handleReset}
          />
        </div>

        <div
          role="tabpanel"
          aria-labelledby="tab-requirements"
          hidden={activeTab !== "requirements"}
        >
          <RequirementsView
            audit={audit}
            coursesById={coursesById}
            manualCredits={manualCredits}
            selectedOption={selectedOption}
            onUpdateManual={(patch) => setManualCredits((prev) => ({ ...prev, ...patch }))}
            onSelectOption={setSelectedOption}
            onInspectCourse={handleInspectFromOtherTab}
          />
        </div>

        <div
          role="tabpanel"
          aria-labelledby="tab-plan"
          hidden={activeTab !== "plan"}
        >
          <FourYearPlanView
            samplePlan={dataset.samplePlan}
            coursesById={coursesById}
            completedIds={completedIds}
            inProgressIds={inProgressIds}
            onInspectCourse={handleInspectFromOtherTab}
          />
        </div>

        <div
          role="tabpanel"
          aria-labelledby="tab-table"
          hidden={activeTab !== "table"}
        >
          <CourseTableView
            courses={dataset.courses}
            edges={dataset.edges}
            completedIds={completedIds}
            inProgressIds={inProgressIds}
            onCycleStatus={cycleCourseStatus}
            onInspectCourse={handleInspectFromOtherTab}
          />
        </div>
      </main>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
