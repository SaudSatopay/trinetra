"use client";

import { useEffect, useRef, useState } from "react";
import { Frame } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";

export function DualStatus({ frames, index }: { frames: Frame[]; index: number }) {
  const cur = frames[index] ?? frames[frames.length - 1] ?? null;
  const tNow = cur ? cur.t_min : 0;
  // The definitive lead is a property of the whole run: how far ahead of the legacy single-sensor
  // alarm the compound alert fires. Compute it from the full frames so a paused money shot shows
  // the true lead (e.g. +6), not the partial time elapsed so far.
  const firstCompound = frames.find((f) => f.summary.compound_alert)?.t_min ?? null;
  const firstBaseline = frames.find((f) => f.summary.baseline_alarm)?.t_min ?? null;
  const compoundNow = cur?.summary.compound_alert ?? false;
  const baselineNow = cur?.summary.baseline_alarm ?? false;

  let lead: number | null = null;
  if (firstCompound !== null && tNow >= firstCompound) {
    lead =
      firstBaseline !== null && firstBaseline >= firstCompound
        ? Math.round(firstBaseline - firstCompound) // legacy will alarm this many minutes later
        : Math.round(tNow - firstCompound); // legacy still blind — show the gap opened so far
  }

  // cinematic: fire a one-shot burst on the RISING edge of the compound catch (re-keyed so the CSS
  // animation replays exactly once per catch, never on the per-frame re-renders during playback).
  const [flashKey, setFlashKey] = useState(0);
  const wasCompound = useRef(false);
  useEffect(() => {
    if (compoundNow && !wasCompound.current) setFlashKey((k) => k + 1);
    wasCompound.current = compoundNow;
  }, [compoundNow]);

  // the money shot: Trinetra has caught it AND the legacy single-sensor is still blind
  const blindSpot = compoundNow && !baselineNow && lead !== null;
  const leadColor = blindSpot ? "var(--good)" : "var(--brand)";

  return (
    <div className="hud-panel lift relative flex h-full flex-1 items-center justify-between overflow-hidden px-7 py-4">
      {flashKey > 0 && (
        <span
          key={flashKey}
          className="money-flash pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 rounded-full"
          style={{ background: "radial-gradient(circle, var(--good-glow), transparent 70%)" }}
        />
      )}
      <Side
        title="Legacy single-sensor"
        active={baselineNow}
        on="Gas alarm"
        off="All clear"
        idle="var(--legacy)"
        live="var(--lvl-high)"
        align="left"
      />

      <div className="relative z-10 flex flex-col items-center px-5">
        <div className="flex items-baseline gap-1">
          {lead !== null ? (
            <AnimatedNumber
              value={lead}
              prefix="+"
              duration={0.5}
              className="tnum text-[27px] font-semibold leading-none"
              style={{
                color: leadColor,
                textShadow: blindSpot ? "0 0 18px var(--good-glow)" : "none",
                transition: "color .45s ease, text-shadow .45s ease",
              }}
            />
          ) : (
            <span className="tnum text-[27px] font-semibold leading-none text-ink-dim">—</span>
          )}
          {lead !== null && <span className="text-[12px] text-ink-dim">min</span>}
        </div>
        <span
          className="label mt-1.5 !text-[8px]"
          style={{ color: blindSpot ? "var(--good)" : undefined, transition: "color .4s ease" }}
        >
          {blindSpot ? "caught early · legacy blind" : "early warning"}
        </span>
        {/* hover reveal — the exact crossover that makes the lead */}
        <span className="reveal mt-1 font-mono text-[9px]" style={{ color: "var(--text-dim)" }}>
          {firstCompound !== null ? `Trinetra T+${firstCompound}` : "Trinetra —"}
          {firstBaseline !== null ? ` · single-sensor T+${firstBaseline}` : " · single-sensor blind"}
        </span>
      </div>

      <Side
        title="Trinetra compound AI"
        active={compoundNow}
        on="Compound alert"
        off="Monitoring"
        idle="var(--good)"
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
