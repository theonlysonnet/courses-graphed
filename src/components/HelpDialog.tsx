"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Fallback light-dismiss for browsers without native <dialog closedby="any">
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const supportsClosedBy = "closedBy" in HTMLDialogElement.prototype;
    if (supportsClosedBy) return;

    let pressedOutside = false;
    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const handleClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = "";
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      id="help-legend-dialog"
      className="help-dialog"
      aria-labelledby="help-dialog-title"
      closedby="any"
      onClose={handleClose}
    >
      <div className="flex flex-col max-h-[85vh]">
        <div
          className="flex items-center justify-between gap-4 px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h1 id="help-dialog-title" className="text-lg font-bold tracking-tight">
            Graph Legend &amp; Planner Guide
          </h1>
          <form method="dialog">
            <button
              type="submit"
              aria-label="Close legend dialog"
              className="inline-flex items-center justify-center rounded-md p-1.5 hover:opacity-80"
              style={{ background: "var(--surface-muted)", color: "var(--text)" }}
              autoFocus
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </div>

        <div className="scroller overflow-y-auto px-5 py-4 space-y-5 text-sm">
          <section className="space-y-2">
            <h2 className="font-semibold text-base">How to Use the Dependency Graph</h2>
            <ul className="list-disc pl-5 space-y-1.5" style={{ color: "var(--text-muted)" }}>
              <li>
                <strong style={{ color: "var(--text)" }}>Click any course node</strong> to open the
                Course Inspector and highlight all transitive prerequisites (amber) and downstream
                courses it unlocks (emerald).
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Click the status icon</strong> on a node
                (or use the inspector buttons) to cycle between{" "}
                <em>Not Taken → In Progress → Completed</em>. Prerequisites automatically recalculate
                what is <strong style={{ color: "var(--ok)" }}>Ready to Take</strong>.
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Isolate Dependency Cone</strong> hides
                unrelated courses so you can focus purely on the path leading to and from one course.
              </li>
              <li>
                <strong style={{ color: "var(--text)" }}>Switch scopes</strong> from the clean{" "}
                <em>Core &amp; Foundations</em> view to <em>All EE Courses</em> or filter by any of
                the 6 EE Advanced Elective areas.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">Edge &amp; Dependency Types</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div
                className="rounded-lg p-3 border"
                style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
              >
                <div className="font-semibold flex items-center gap-2">
                  <span className="inline-block w-6 border-t-2 border-current" />
                  Required Prereq
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Must be completed before taking the target course.
                </p>
              </div>
              <div
                className="rounded-lg p-3 border"
                style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
              >
                <div className="font-semibold flex items-center gap-2">
                  <span className="inline-block w-6 border-t-2 border-dashed border-sky-500" />
                  Co-req / Prereq
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Completed OR concurrent enrollment satisfies this edge (e.g. E C E 340 → 370).
                </p>
              </div>
              <div
                className="rounded-lg p-3 border"
                style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
              >
                <div className="font-semibold flex items-center gap-2">
                  <span className="inline-block w-6 border-t-2 border-dotted border-amber-500" />
                  OR-Alternative
                </div>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  One of multiple acceptable options in an OR group (toggleable in toolbar).
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-base">Category Color Coding (Left Border)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {[
                { label: "EE Core (32 cr)", color: "#c5050c" },
                { label: "Mathematics (16 cr)", color: "#2563eb" },
                { label: "Science & CS (17-18 cr)", color: "#0d9488" },
                { label: "EE Advanced Electives", color: "#7c3aed" },
                { label: "Professional Electives", color: "#d97706" },
                { label: "Communication Skills", color: "#db2777" },
                { label: "Named Option Extra", color: "#0284c7" },
                { label: "External Foundational", color: "#64748b" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded px-2.5 py-1.5 border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span
                    className="inline-block w-2.5 h-4 rounded-sm shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <p>
              <strong style={{ color: "var(--text)" }}>Source:</strong> Official 2026–2027
              UW–Madison Undergraduate Guide (Electrical Engineering, BS &amp; CourseLeaf requisites).
              Exclusions (&ldquo;Not open to students with credit for...&rdquo;) are shown in the
              Course Inspector and degree audit warnings, never as prerequisite arrows.
            </p>
          </section>
        </div>

        <div
          className="flex justify-end px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <form method="dialog">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-md text-sm font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
            >
              Done
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
