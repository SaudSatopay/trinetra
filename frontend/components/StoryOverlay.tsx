"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { StoryStep } from "@/lib/story";
import { PhonePush } from "./PhonePush";

/** The narrated Story-mode overlay: a lower-third caption that names each beat, a step
 *  progress strip, and — on the final beat — the evac-push phone sliding in. Portaled to
 *  the body so position:fixed is measured against the viewport, never a transformed ancestor. */
export function StoryOverlay({
  step,
  idx,
  total,
  onExit,
  zoneName,
  evacMessage,
}: {
  step: StoryStep;
  idx: number;
  total: number;
  onExit: () => void;
  zoneName: string;
  evacMessage: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onExit();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onExit]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {/* the evac-push phone, on the final beat */}
      {step.focus === "phone" && (
        <div
          key="phone"
          className="pointer-events-auto absolute right-7 top-1/2 -translate-y-1/2"
          style={{ animation: "phoneSlideIn 0.6s var(--ease-out-expo) both" }}
        >
          <PhonePush zoneName={zoneName} message={evacMessage} />
        </div>
      )}

      {/* lower-third caption */}
      <div className="absolute bottom-7 left-1/2 w-[min(740px,92vw)] -translate-x-1/2">
        <div
          key={idx}
          className="rise-in pointer-events-auto overflow-hidden rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--panel) 92%, transparent)",
            border: "1px solid var(--line-2)",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            backdropFilter: "blur(6px)",
          }}
        >
          {/* progress bar — fills across the beat's dwell */}
          <div className="relative h-0.5 w-full" style={{ background: "var(--line)" }}>
            <div
              key={idx}
              className="absolute inset-y-0 left-0"
              style={{ background: "var(--brand)", animation: `storyFill ${step.dwellMs}ms linear both` }}
            />
          </div>

          <div className="flex items-start gap-4 px-5 py-3.5">
            <div className="flex shrink-0 flex-col items-center pt-0.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-dim">Story</span>
              <span className="tnum text-[15px] font-semibold text-brand">
                {idx + 1}
                <span className="text-[10px] text-ink-dim">/{total}</span>
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-display text-[14px] font-semibold leading-tight text-ink-bright">{step.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-ink">{step.caption}</div>
            </div>

            <button
              onClick={onExit}
              className="tappable shrink-0 rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-ink-dim"
              style={{ border: "1px solid var(--line-2)" }}
              title="Exit story mode (Esc)"
            >
              ✕ Exit
            </button>
          </div>

          {/* step dots */}
          <div className="flex items-center gap-1.5 px-5 pb-3">
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 22 : 8,
                  background: i === idx ? "var(--brand)" : i < idx ? "color-mix(in srgb, var(--brand) 45%, transparent)" : "var(--line-2)",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
