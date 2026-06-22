"use client";

import { ReactNode } from "react";
import { Frame, ScenarioInfo } from "@/lib/types";

const SPEEDS = [1, 2, 4, 8];

export function Player({
  scenarios,
  scenario,
  onScenario,
  playing,
  onTogglePlay,
  onReset,
  speed,
  onSpeed,
  index,
  frames,
  onSeek,
  extra,
}: {
  scenarios: ScenarioInfo[];
  scenario: string;
  onScenario: (s: string) => void;
  playing: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  speed: number;
  onSpeed: (s: number) => void;
  index: number;
  frames: Frame[];
  onSeek: (i: number) => void;
  extra?: ReactNode;
}) {
  const len = frames.length;
  const tNow = frames[index]?.t_min ?? 0;
  const firstCompound = frames.findIndex((f) => f.summary.compound_alert);
  const firstBaseline = frames.findIndex((f) => f.summary.baseline_alarm);

  return (
    <div className="hud-panel flex items-center gap-5 px-5 py-3">
      {/* scenarios */}
      <div className="flex items-center gap-1">
        {scenarios.map((s) => {
          const on = s.name === scenario;
          return (
            <button
              key={s.name}
              onClick={() => onScenario(s.name)}
              title={s.title}
              className="rounded-md px-3 py-1.5 font-mono text-[10px] lowercase tracking-wide transition-colors"
              style={{
                color: on ? "var(--brand)" : "var(--text-dim)",
                background: on ? "color-mix(in srgb, var(--brand) 11%, transparent)" : "transparent",
              }}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {extra}

      <div className="h-6 w-px bg-line" />

      {/* transport */}
      <div className="flex items-center gap-3">
        <button onClick={onReset} className="text-ink-dim transition-colors hover:text-ink" title="Reset">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" /></svg>
        </button>
        <button
          onClick={onTogglePlay}
          className="grid h-9 w-9 place-items-center rounded-full transition-colors"
          style={{ background: "var(--brand)", color: "#04110e" }}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <div className="flex items-center gap-1.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className="font-mono text-[10px] transition-colors"
              style={{ color: s === speed ? "var(--brand)" : "var(--text-dim)" }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* timeline */}
      <div className="flex flex-1 items-center gap-3">
        <span className="tnum w-10 text-[11px] text-ink-dim">T+{String(Math.floor(tNow)).padStart(2, "0")}</span>
        <div className="relative h-5 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-2" />
          {firstCompound >= 0 && len > 1 && (
            <Tick pos={firstCompound / (len - 1)} color="var(--brand)" />
          )}
          {firstBaseline >= 0 && len > 1 && (
            <Tick pos={firstBaseline / (len - 1)} color="var(--lvl-high)" />
          )}
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 rounded-full bg-brand"
            style={{ left: 0, width: `${len > 1 ? (index / (len - 1)) * 100 : 0}%` }}
          />
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
            style={{ left: `${len > 1 ? (index / (len - 1)) * 100 : 0}%`, boxShadow: "0 0 8px var(--brand-glow)" }}
          />
          <input
            type="range"
            min={0}
            max={Math.max(0, len - 1)}
            value={index}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label="timeline"
          />
        </div>
      </div>
    </div>
  );
}

function Tick({ pos, color }: { pos: number; color: string }) {
  return (
    <div
      className="absolute top-1/2 h-2.5 w-px -translate-y-1/2"
      style={{ left: `${pos * 100}%`, background: color, opacity: 0.7 }}
    />
  );
}
