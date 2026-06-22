"use client";

import { Frame } from "@/lib/types";

export function DualStatus({ history }: { history: Frame[] }) {
  const cur = history[history.length - 1];
  const tNow = cur ? cur.t_min : 0;
  const firstCompound = history.find((f) => f.summary.compound_alert)?.t_min ?? null;
  const firstBaseline = history.find((f) => f.summary.baseline_alarm)?.t_min ?? null;

  let lead: number | null = null;
  if (firstCompound !== null && firstBaseline === null) lead = Math.round(tNow - firstCompound);
  else if (firstCompound !== null && firstBaseline !== null && firstBaseline >= firstCompound)
    lead = Math.round(firstBaseline - firstCompound);

  const legacyAlarm = cur?.summary.baseline_alarm ?? false;
  const trinetraCompound = cur?.summary.compound_alert ?? false;

  return (
    <div className="hud-panel grid grid-cols-[1fr_auto_1fr] items-stretch">
      {/* legacy */}
      <Side
        kind="legacy"
        title="Legacy Single-Sensor"
        sub="Threshold detection only"
        active={legacyAlarm}
        activeLabel="GAS ALARM"
        idleLabel="ALL CLEAR"
        color="var(--legacy)"
        activeColor="var(--lvl-high)"
      />

      {/* lead-time spine */}
      <div className="flex flex-col items-center justify-center border-x border-line px-6 py-3">
        <div className="label !text-[8px]">Early Warning</div>
        <div
          className="tnum mt-1 text-[34px] font-semibold leading-none"
          style={{ color: lead ? "var(--brand)" : "var(--text-dim)", textShadow: lead ? "0 0 18px var(--brand-glow)" : "none" }}
        >
          {lead !== null ? `+${lead}` : "--"}
        </div>
        <div className="label mt-1 !tracking-[0.2em]">minutes</div>
      </div>

      {/* trinetra */}
      <Side
        kind="trinetra"
        title="Trinetra Compound AI"
        sub="Multi-signal fusion"
        active={trinetraCompound}
        activeLabel="COMPOUND ALERT"
        idleLabel="MONITORING"
        color="var(--brand)"
        activeColor="var(--lvl-critical)"
      />
    </div>
  );
}

function Side({
  title,
  sub,
  active,
  activeLabel,
  idleLabel,
  color,
  activeColor,
}: {
  kind: string;
  title: string;
  sub: string;
  active: boolean;
  activeLabel: string;
  idleLabel: string;
  color: string;
  activeColor: string;
}) {
  const c = active ? activeColor : color;
  return (
    <div className="flex flex-col justify-center gap-1.5 px-5 py-3.5">
      <div className="label">{title}</div>
      <div className="flex items-center gap-2.5">
        <span
          className={`inline-block h-3 w-3 rounded-full ${active ? "animate-pulse-crit" : ""}`}
          style={{ background: c, boxShadow: `0 0 12px ${c}` }}
        />
        <span className="font-display text-[18px] font-bold tracking-[0.12em]" style={{ color: c }}>
          {active ? activeLabel : idleLabel}
        </span>
      </div>
      <div className="font-mono text-[10px] text-ink-dim">{sub}</div>
    </div>
  );
}
