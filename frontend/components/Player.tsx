"use client";

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
}) {
  const len = frames.length;
  const tNow = frames[index]?.t_min ?? 0;
  const firstCompound = frames.findIndex((f) => f.summary.compound_alert);
  const firstBaseline = frames.findIndex((f) => f.summary.baseline_alarm);

  return (
    <div className="hud-panel flex items-center gap-4 px-4 py-2.5">
      {/* scenario segmented */}
      <div className="flex items-center gap-1.5">
        {scenarios.map((s) => {
          const on = s.name === scenario;
          return (
            <button
              key={s.name}
              onClick={() => onScenario(s.name)}
              className="group relative border px-2.5 py-1.5 transition-colors"
              style={{
                borderColor: on ? "var(--brand)" : "var(--line-2)",
                background: on ? "color-mix(in srgb, var(--brand) 14%, transparent)" : "transparent",
              }}
              title={s.title}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-wide"
                style={{ color: on ? "var(--brand)" : "var(--text-dim)" }}
              >
                {s.name}
              </span>
              <span
                className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ background: s.expected_compound ? "var(--lvl-critical)" : "var(--lvl-normal)" }}
                title={s.expected_compound ? "compound hazard" : "benign"}
              />
            </button>
          );
        })}
      </div>

      <div className="h-7 w-px bg-line" />

      {/* transport */}
      <div className="flex items-center gap-2">
        <button onClick={onReset} className="grid h-8 w-8 place-items-center border border-line-2 text-ink-dim hover:text-ink" title="Reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
          </svg>
        </button>
        <button
          onClick={onTogglePlay}
          className="grid h-9 w-9 place-items-center border"
          style={{ borderColor: "var(--brand)", color: "var(--brand)", background: "color-mix(in srgb, var(--brand) 12%, transparent)" }}
          title={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <div className="flex border border-line-2">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className="px-2 py-1 font-mono text-[10px]"
              style={{ color: s === speed ? "var(--brand)" : "var(--text-dim)", background: s === speed ? "color-mix(in srgb, var(--brand) 12%, transparent)" : "transparent" }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* timeline */}
      <div className="flex flex-1 items-center gap-3">
        <span className="tnum text-[12px] text-ink-bright">T+{String(Math.floor(tNow)).padStart(2, "0")}</span>
        <div className="relative h-2 flex-1">
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-2" />
          {/* event markers */}
          {firstCompound >= 0 && len > 1 && (
            <Marker pos={firstCompound / (len - 1)} color="var(--brand)" label="compound" />
          )}
          {firstBaseline >= 0 && len > 1 && (
            <Marker pos={firstBaseline / (len - 1)} color="var(--lvl-high)" label="legacy" />
          )}
          {/* progress */}
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 bg-brand"
            style={{ left: 0, width: `${len > 1 ? (index / (len - 1)) * 100 : 0}%` }}
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
          <div
            className="pointer-events-none absolute top-1/2 h-3.5 w-1 -translate-y-1/2 bg-brand"
            style={{ left: `calc(${len > 1 ? (index / (len - 1)) * 100 : 0}% - 1px)`, boxShadow: "0 0 8px var(--brand-glow)" }}
          />
        </div>
      </div>
    </div>
  );
}

function Marker({ pos, color, label }: { pos: number; color: string; label: string }) {
  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pos * 100}%` }}>
      <div className="h-3 w-px" style={{ background: color }} />
      <div className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap font-mono text-[8px]" style={{ color }}>
        {label}
      </div>
    </div>
  );
}
