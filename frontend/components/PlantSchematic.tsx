"use client";

import { Level, MainView, Plant, Zone } from "@/lib/types";
import { GAS_ORDER, levelColor, levelRank } from "@/lib/risk";

// gas reading severity → colour (GOOD = green, then the heat ramp)
const STAGE_COLOR: Record<string, string> = {
  "": "var(--good)",
  low: "var(--lvl-watch)",
  high: "var(--lvl-elevated)",
  danger: "var(--lvl-critical)",
};
import { Frame } from "@/lib/types";
import { AnimatedNumber } from "./AnimatedNumber";
import { ViewToggle } from "./ViewToggle";

export function PlantSchematic({
  plant,
  frame,
  selected,
  onSelect,
  view,
  onView,
}: {
  plant: Plant;
  frame: Frame;
  selected: string | null;
  onSelect: (id: string) => void;
  view: MainView;
  onView: (v: MainView) => void;
}) {
  const zoneById: Record<string, Zone> = Object.fromEntries(frame.zones.map((z) => [z.id, z]));
  const specById = Object.fromEntries(plant.zones.map((z) => [z.id, z]));
  const xs = plant.zones.map((z) => z.x);
  const ys = plant.zones.map((z) => z.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const nx = (x: number) => 13 + ((x - minX) / (maxX - minX || 1)) * 74;
  const ny = (y: number) => 20 + ((y - minY) / (maxY - minY || 1)) * 62;

  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const z of plant.zones)
    for (const n of z.neighbours) {
      const key = [z.id, n].sort().join("|");
      if (!seen.has(key) && specById[n]) {
        seen.add(key);
        pairs.push([z.id, n]);
      }
    }

  return (
    <div className="hud-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <span className="label">Plant Overview</span>
        <div className="flex items-center gap-3">
          <span className="hidden font-sans text-[11px] text-ink-dim lg:inline">{plant.name}</span>
          <ViewToggle view={view} onView={onView} />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {/* continuous risk heat-field — blooms scale with each zone's live risk */}
        {plant.zones.map((spec) => {
          const z = zoneById[spec.id];
          if (levelRank(z.risk.level) < 1) return null; // keep clean: only above-normal zones radiate
          const col = levelColor[z.risk.level];
          const intensity = Math.min(0.5, 0.12 + (z.risk.score / 100) * 0.4);
          return (
            <div
              key={spec.id + "-heat"}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${nx(spec.x)}%`,
                top: `${ny(spec.y)}%`,
                width: 240,
                height: 170,
                background: `radial-gradient(ellipse at center, ${col}, transparent 66%)`,
                opacity: intensity,
                filter: "blur(26px)",
                transition: "opacity .6s ease, background .6s ease",
              }}
            />
          );
        })}

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pairs.map(([a, b]) => {
            const za = zoneById[a], zb = zoneById[b];
            const sa = specById[a], sb = specById[b];
            const hotLevel: Level =
              levelRank(za.risk.level) >= levelRank(zb.risk.level) ? za.risk.level : zb.risk.level;
            const hot = levelRank(hotLevel) >= 3; // only high/critical links light up
            const x1 = nx(sa.x), y1 = ny(sa.y), x2 = nx(sb.x), y2 = ny(sb.y);
            const col = hot ? levelColor[hotLevel] : "var(--line-2)";
            return (
              <g key={a + b}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={col}
                  strokeWidth={hot ? 1.4 : 1}
                  vectorEffect="non-scaling-stroke"
                  opacity={hot ? 0.5 : 0.22}
                  style={{ transition: "stroke .5s ease, opacity .5s ease" }}
                />
                {hot && (
                  <line
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={col}
                    strokeWidth={1.8}
                    vectorEffect="non-scaling-stroke"
                    className="flow-line"
                    opacity={0.95}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {plant.zones.map((spec) => {
          const z = zoneById[spec.id];
          if (!z) return null; // defensive: never let a missing zone collapse the whole schematic
          return (
            <ZoneNode
              key={spec.id}
              z={z}
              left={nx(spec.x)}
              top={ny(spec.y)}
              selected={selected === spec.id}
              onSelect={() => onSelect(spec.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ZoneNode({
  z,
  left,
  top,
  selected,
  onSelect,
}: {
  z: Zone;
  left: number;
  top: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const lvl = z.risk.level;
  const col = levelColor[lvl];
  const rank = levelRank(lvl);
  const active = rank >= 2; // elevated+
  // the halo/pulse is the LETHAL-COMPOUND signal — gate it on the verdict, not just the score, so a
  // high-gas-but-not-compound zone (e.g. inerted, or a release with no ignition/people) shows its
  // severity colour without the false "emergency" halo. Keeps the visual honest with the engine.
  const crit = lvl === "critical" && z.risk.compound;

  return (
    <button
      onClick={onSelect}
      className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-left transition-transform hover:z-30 hover:scale-[1.07]"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: 132,
        background: active ? `color-mix(in srgb, ${col} 8%, var(--panel))` : "var(--panel)",
        border: `1px solid ${active ? col : "var(--line-2)"}`,
        boxShadow: crit ? `0 8px 30px -10px ${col}` : "none",
        transition:
          "transform .22s cubic-bezier(.4,0,.2,1), background .5s ease, border-color .5s ease, box-shadow .5s ease",
      }}
    >
      {crit && (
        <span
          className="halo pointer-events-none absolute -inset-1 rounded-2xl"
          style={{ boxShadow: `0 0 22px -2px ${col}` }}
        />
      )}
      {selected && (
        <span
          className="pointer-events-none absolute -inset-[3px] rounded-[14px] border"
          style={{ borderColor: "var(--brand)", opacity: 0.55 }}
        />
      )}
      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${crit ? "soft-pulse" : ""}`}
          style={{ background: col, boxShadow: active ? `0 0 7px ${col}` : "none" }}
        />
        <span className="font-display text-[13px] font-semibold tracking-wide text-ink-bright">{z.id}</span>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-[9px] capitalize text-ink-dim">{z.kind.replace(/_/g, " ")}</span>
        <AnimatedNumber
          value={z.risk.score}
          duration={0.4}
          className="tnum text-[13px] leading-none"
          style={{ color: active ? col : "var(--text-dim)", transition: "color .5s ease" }}
        />
      </div>
      {z.workers.length > 0 && (
        <div className="mt-2 flex items-center gap-1" title={`${z.workers.length} personnel on site`}>
          {z.workers.slice(0, 5).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: active ? col : "var(--text-dim)" }} />
          ))}
          <span className="ml-0.5 text-[8px] text-ink-dim">{z.workers.length} on site</span>
        </div>
      )}
      {/* hover reveal — live gas readout (GOOD=green, heating to red) + projected breach */}
      <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:mt-2.5 group-hover:max-h-28 group-hover:opacity-100">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2" style={{ borderColor: "var(--line)" }}>
          {GAS_ORDER.map((g) => {
            const gd = z.gases[g];
            if (!gd) return null;
            return (
              <div key={g} className="flex items-center justify-between font-mono text-[8.5px] leading-none">
                <span className="text-ink-dim">{g}</span>
                <span style={{ color: STAGE_COLOR[gd.stage] ?? "var(--good)" }}>{gd.value}</span>
              </div>
            );
          })}
        </div>
        {z.risk.time_to_threshold_min != null && (
          <div className="mt-1.5 font-mono text-[8px]" style={{ color: "var(--brand)" }}>
            projected breach ~{z.risk.time_to_threshold_min}m
          </div>
        )}
      </div>
    </button>
  );
}
