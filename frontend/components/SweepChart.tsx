"use client";

// The honesty exhibit, visualized: run the same real data through the same engine across y-scales.
// Trinetra's compound DETECTION (green) stays flat — scale-robust; the single-sensor baseline (grey)
// swings — scale-sensitive; the shaded gap between them is the lead. So the lead is disclosed as a
// curve, not quoted as one flattering number.
export interface SweepRow {
  scale: number;
  compound_min: number | null;
  single_sensor_min: number | null;
  lead_min: number | null;
}

export function SweepChart({ rows, shipped }: { rows: SweepRow[]; shipped: number }) {
  if (!rows || rows.length < 2) return null;
  const w = 216;
  const h = 50;
  const padX = 7;
  const padTop = 5;
  const padBot = 11;
  const n = rows.length;
  const xs = rows.map((_, i) => padX + (i * (w - 2 * padX)) / (n - 1));
  const maxY = Math.max(1, ...rows.map((r) => Math.max(r.compound_min ?? 0, r.single_sensor_min ?? 0)));
  const y = (v: number | null) => (v == null ? h - padBot : h - padBot - (v / maxY) * (h - padTop - padBot));
  const line = (key: "compound_min" | "single_sensor_min") =>
    rows.map((r, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)} ${y(r[key]).toFixed(1)}`).join(" ");
  // shaded gap = the lead
  const gap =
    rows.map((r, i) => `${i ? "L" : "M"}${xs[i].toFixed(1)} ${y(r.single_sensor_min).toFixed(1)}`).join(" ") +
    " " +
    rows
      .slice()
      .reverse()
      .map((r, i) => `L${xs[n - 1 - i].toFixed(1)} ${y(r.compound_min).toFixed(1)}`)
      .join(" ") +
    " Z";

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
        <span className="flex items-center gap-1">
          <span className="h-[2px] w-3 rounded" style={{ background: "var(--good)" }} /> detection
        </span>
        <span className="flex items-center gap-1">
          <span className="h-[2px] w-3 rounded" style={{ background: "var(--legacy)" }} /> single-sensor
        </span>
        <span style={{ color: "var(--brand)" }}>gap = lead</span>
      </span>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
        <path d={gap} fill="color-mix(in srgb, var(--brand) 13%, transparent)" stroke="none" />
        <path d={line("single_sensor_min")} fill="none" stroke="var(--legacy)" strokeWidth={1.4} strokeLinejoin="round" />
        <path d={line("compound_min")} fill="none" stroke="var(--good)" strokeWidth={1.9} strokeLinejoin="round" />
        {rows.map((r, i) =>
          r.scale === shipped ? (
            <circle key={i} cx={xs[i]} cy={y(r.compound_min)} r={2.8} fill="var(--good)" stroke="var(--bg)" strokeWidth={1} />
          ) : null
        )}
        {rows.map((r, i) => (
          <text
            key={i}
            x={xs[i]}
            y={h - 1.5}
            textAnchor="middle"
            fontSize={6.5}
            fill={r.scale === shipped ? "var(--text)" : "var(--text-dim)"}
            fontWeight={r.scale === shipped ? 700 : 400}
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ×{r.scale}
          </text>
        ))}
      </svg>
    </span>
  );
}
