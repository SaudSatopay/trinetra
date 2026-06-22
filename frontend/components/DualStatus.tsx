"use client";

import { Frame } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

export function DualStatus({ history }: { history: Frame[] }) {
  const cur = history[history.length - 1];
  const tNow = cur ? cur.t_min : 0;
  const firstCompound = history.find((f) => f.summary.compound_alert)?.t_min ?? null;
  const firstBaseline = history.find((f) => f.summary.baseline_alarm)?.t_min ?? null;

  let lead: number | null = null;
  if (firstCompound !== null && firstBaseline === null) lead = Math.round(tNow - firstCompound);
  else if (firstCompound !== null && firstBaseline !== null && firstBaseline >= firstCompound)
    lead = Math.round(firstBaseline - firstCompound);

  return (
    <div className="hud-panel flex h-full flex-1 items-center justify-between px-7 py-4">
      <Side
        title="Legacy single-sensor"
        active={cur?.summary.baseline_alarm ?? false}
        on="Gas alarm"
        off="All clear"
        idle="var(--legacy)"
        live="var(--lvl-high)"
        align="left"
      />

      <div className="flex flex-col items-center px-5">
        <div className="flex items-baseline gap-1">
          {lead !== null ? (
            <AnimatedNumber
              value={lead}
              prefix="+"
              duration={0.5}
              className="tnum text-[27px] font-semibold leading-none"
              style={{ color: "var(--brand)" }}
            />
          ) : (
            <span className="tnum text-[27px] font-semibold leading-none text-ink-dim">—</span>
          )}
          {lead !== null && <span className="text-[12px] text-ink-dim">min</span>}
        </div>
        <span className="label mt-1.5 !text-[8px]">early warning</span>
      </div>

      <Side
        title="Trinetra compound AI"
        active={cur?.summary.compound_alert ?? false}
        on="Compound alert"
        off="Monitoring"
        idle="var(--brand)"
        live="var(--lvl-critical)"
        align="right"
      />
    </div>
  );
}

function Side({
  title,
  active,
  on,
  off,
  idle,
  live,
  align,
}: {
  title: string;
  active: boolean;
  on: string;
  off: string;
  idle: string;
  live: string;
  align: "left" | "right";
}) {
  const c = active ? live : idle;
  return (
    <div className={`flex flex-col gap-1.5 ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="label !text-[9px]">{title}</span>
      <div className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <span
          className={`h-2 w-2 rounded-full ${active ? "soft-pulse" : ""}`}
          style={{ background: c, boxShadow: `0 0 8px ${c}`, transition: "background .4s ease, box-shadow .4s ease" }}
        />
        <span
          className="font-display text-[15px] font-semibold tracking-wide"
          style={{ color: c, transition: "color .4s ease" }}
        >
          {active ? on : off}
        </span>
      </div>
    </div>
  );
}
