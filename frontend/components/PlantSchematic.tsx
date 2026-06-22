"use client";

import { Frame, Level, Plant, Zone } from "@/lib/types";
import { levelColor, levelLabel, LEVELS, levelRank } from "@/lib/risk";

function dominant(z: Zone): { sp: string; frac: number; alarm: boolean } {
  let best = { sp: "", frac: -1, alarm: false };
  for (const [sp, g] of Object.entries(z.gases)) {
    const frac = sp === "O2" ? (20.9 - g.value) / (20.9 - 16) : g.frac;
    if (frac > best.frac) best = { sp, frac, alarm: !!g.stage };
  }
  return best;
}

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
  const nx = (x: number) => 9 + ((x - minX) / (maxX - minX || 1)) * 82;
  const ny = (y: number) => 16 + ((y - minY) / (maxY - minY || 1)) * 70;

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
    <div className="hud-panel relative flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <span className="label">Plant Mimic · Geospatial Risk</span>
        <div className="flex items-center gap-2.5">
          {LEVELS.map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: levelColor[l] }} />
              <span className="label !text-[8px]">{levelLabel[l]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand/[0.06] to-transparent animate-sweep" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {pairs.map(([a, b]) => {
            const za = zoneById[a], zb = zoneById[b];
            const sa = specById[a], sb = specById[b];
            const hotLevel: Level = levelRank(za.risk.level) >= levelRank(zb.risk.level) ? za.risk.level : zb.risk.level;
            const hot = levelRank(hotLevel) >= 2;
            const col = hot ? levelColor[hotLevel] : "var(--line-2)";
            return (
              <line
                key={a + b}
                x1={nx(sa.x)} y1={ny(sa.y)} x2={nx(sb.x)} y2={ny(sb.y)}
                stroke={col}
                strokeWidth={hot ? 1.6 : 1}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={hot ? "4 3" : undefined}
                opacity={hot ? 0.92 : 0.35}
                style={hot ? { filter: `drop-shadow(0 0 3px ${col})` } : undefined}
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
  const crit = lvl === "critical";
  const dom = dominant(z);
  const hasHot = z.permits.some((p) => p.type === "hot_work" || p.type === "electrical_isolation");
  const hasConfined = z.permits.some((p) => p.type === "confined_space_entry");
  const glow =
    rank >= 3 ? `0 0 24px ${col}55` : rank >= 2 ? `0 0 13px ${col}33` : rank >= 1 ? `0 0 8px ${col}22` : "none";

  return (
    <button
      onClick={onSelect}
      className={`absolute z-10 w-[150px] -translate-x-1/2 -translate-y-1/2 border bg-panel/95 px-2.5 py-2 text-left transition-all duration-300 ${crit ? "animate-pulse-crit" : ""}`}
      style={{ left: `${left}%`, top: `${top}%`, borderColor: col, boxShadow: glow }}
    >
      {selected && <span className="pointer-events-none absolute -inset-[5px] border border-brand/55" />}
      {crit && <span className="pointer-events-none absolute -inset-2.5 animate-flare rounded-sm border" style={{ borderColor: col }} />}

      <div className="flex items-center justify-between">
        <span className="font-display text-[13px] font-bold tracking-wide text-ink-bright">{z.id}</span>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
      </div>
      <div className="mt-0.5 truncate text-[9px] text-ink-dim">{z.name}</div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="tnum text-[11px]" style={{ color: col }}>
          {Math.round(z.risk.score)}
          <span className="text-ink-dim">/100</span>
        </span>
        <span className="font-mono text-[9px]" style={{ color: dom.alarm ? "var(--lvl-high)" : "var(--text-dim)" }}>
          {dom.sp} {Math.round(dom.frac * 100)}%
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {z.workers.length > 0 && <Chip kind="person" label={String(z.workers.length)} />}
        {hasHot && <Chip kind="flame" label="HW" warn />}
        {hasConfined && <Chip kind="confined" label="CS" />}
        {z.risk.compound && (
          <span className="ml-auto animate-blink font-mono text-[8px] font-bold tracking-wider" style={{ color: "var(--lvl-critical)" }}>
            ◣COMPOUND
          </span>
        )}
      </div>
    </button>
  );
}

function Chip({ kind, label, warn }: { kind: string; label: string; warn?: boolean }) {
  const c = warn ? "var(--lvl-elevated)" : "var(--text-dim)";
  return (
    <span className="flex items-center gap-0.5 border px-1 py-px font-mono text-[8px]" style={{ borderColor: "var(--line-2)", color: c }}>
      <Icon kind={kind} />
      {label}
    </span>
  );
}

function Icon({ kind }: { kind: string }) {
  if (kind === "person")
    return (
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>
    );
  if (kind === "flame")
    return (
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" /></svg>
    );
  return <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="1" /></svg>;
}
