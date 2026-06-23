"use client";

import { MainView } from "@/lib/types";

const SEGMENTS: { id: MainView; label: string }[] = [
  { id: "plant", label: "Plant" },
  { id: "fleet", label: "Fleet" },
  { id: "graph", label: "Knowledge" },
];

/** Segmented control switching the main panel between the single-plant view,
 *  the multi-plant fleet board, and the knowledge graph. */
export function ViewToggle({ view, onView }: { view: MainView; onView: (v: MainView) => void }) {
  return (
    <div
      className="flex items-center gap-0.5 rounded-md p-0.5"
      style={{ border: "1px solid var(--line-2)", background: "var(--panel-2)" }}
    >
      {SEGMENTS.map((s) => {
        const active = view === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onView(s.id)}
            className="rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors"
            style={
              active
                ? { color: "var(--brand)", background: "color-mix(in srgb, var(--brand) 12%, transparent)" }
                : { color: "var(--text-dim)" }
            }
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
