"use client";

import { Level, Plant, Zone } from "@/lib/types";
import { levelColor, levelRank } from "@/lib/risk";
import { Frame } from "@/lib/types";

export function PlantSchematic({
  plant,
  frame,
  selected,
  onSelect,
}: {
  plant: Plant;
  frame: Frame;
  selected: string | null;
  onSelect: (id: string) => void;
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
        <span className="font-mono text-[10px] text-ink-dim">{plant.name}</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pairs.map(([a, b]) => {
            const za = zoneById[a], zb = zoneById[b];
            const sa = specById[a], sb = specById[b];
            const hotLevel: Level =
              levelRank(za.risk.level) >= levelRank(zb.risk.level) ? za.risk.level : zb.risk.level;
            const hot = levelRank(hotLevel) >= 3; // only high/critical links light up
            return (
              <line
                key={a + b}
                x1={nx(sa.x)} y1={ny(sa.y)} x2={nx(sb.x)} y2={ny(sb.y)}
                stroke={hot ? levelColor[hotLevel] : "var(--line-2)"}
                strokeWidth={hot ? 1.4 : 1}
                vectorEffect="non-scaling-stroke"
                opacity={hot ? 0.6 : 0.22}
              />
            );
          })}
        </svg>

        {plant.zones.map((spec) => (
          <ZoneNode
            key={spec.id}
            z={zoneById[spec.id]}
            left={nx(spec.x)}
            top={ny(spec.y)}
            selected={selected === spec.id}
            onSelect={() => onSelect(spec.id)}
          />
        ))}
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
  const crit = lvl === "critical";

  return (
    <button
      onClick={onSelect}
      className="group absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-4 py-3 text-left transition-all duration-500"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: 132,
        background: active ? `color-mix(in srgb, ${col} 8%, var(--panel))` : "var(--panel)",
        border: `1px solid ${active ? col : "var(--line-2)"}`,
        boxShadow: crit ? `0 8px 30px -10px ${col}` : "none",
      }}
    >
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
        <span className="tnum text-[13px] leading-none" style={{ color: active ? col : "var(--text-dim)" }}>
          {Math.round(z.risk.score)}
        </span>
      </div>
    </button>
  );
}
