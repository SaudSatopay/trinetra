"use client";

import { MainView } from "@/lib/types";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SEGMENTS: { id: MainView; label: string }[] = [
  { id: "plant", label: "Plant" },
  { id: "fleet", label: "Fleet" },
  { id: "graph", label: "Knowledge" },
];

// measure pre-paint on the client; fall back to effect on the server (no SSR warning)
const useIsoLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Segmented control switching the main panel between the single-plant view,
 *  the multi-plant fleet board, and the knowledge graph. A sliding lamp glides
 *  under the active segment (measured, so it tracks the natural label widths). */
export function ViewToggle({ view, onView }: { view: MainView; onView: (v: MainView) => void }) {
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [ind, setInd] = useState({ x: 0, y: 0, w: 0, h: 0 });

  useIsoLayout(() => {
    const i = SEGMENTS.findIndex((s) => s.id === view);
    const el = btns.current[i];
    if (el) setInd({ x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  }, [view]);

  return (
    <div
      className="seg-track flex items-center gap-0.5 rounded-md p-0.5"
      style={{ border: "1px solid var(--line-2)", background: "var(--panel-2)" }}
    >
      <span
        className="seg-ind"
        style={{
          transform: `translate(${ind.x}px, ${ind.y}px)`,
          width: ind.w,
          height: ind.h,
          background: "color-mix(in srgb, var(--brand) 14%, transparent)",
          boxShadow:
            "inset 0 0 0 1px color-mix(in srgb, var(--brand) 32%, transparent), 0 0 16px -7px var(--brand-glow)",
          opacity: ind.w ? 1 : 0,
        }}
      />
      {SEGMENTS.map((s, i) => {
        const active = view === s.id;
        return (
          <button
            key={s.id}
            ref={(el) => {
              btns.current[i] = el;
            }}
            onClick={() => onView(s.id)}
            className="seg-btn tappable rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: active ? "var(--brand)" : "var(--text-dim)" }}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-dim)";
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
