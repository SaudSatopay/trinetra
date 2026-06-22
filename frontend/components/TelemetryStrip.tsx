import { Frame, Threshold } from "@/lib/types";
import { GAS_ORDER } from "@/lib/risk";

interface SparkCfg {
  min: number;
  max: number;
  threshold: number;
  invert: boolean; // O2: lower is worse
}

function cfgFor(sp: string, thr: Threshold | undefined, data: number[]): SparkCfg {
  if (sp === "O2") return { min: 15, max: 21, threshold: thr?.low ?? 19.5, invert: true };
  const low = thr?.low ?? 10;
  const max = Math.max(low * 1.25, ...data, 1);
  return { min: 0, max, threshold: low, invert: false };
}

function Spark({
  sp,
  values,
  cfg,
  unit,
  inAlarm,
}: {
  sp: string;
  values: number[];
  cfg: SparkCfg;
  unit: string;
  inAlarm: boolean;
}) {
  const w = 150;
  const h = 38;
  const n = values.length;
  const y = (v: number) => h - ((v - cfg.min) / (cfg.max - cfg.min)) * h;
  const pts = values.map((v, i) => `${n <= 1 ? 0 : (i / (n - 1)) * w},${y(v).toFixed(1)}`).join(" ");
  const ty = y(cfg.threshold);
  const cur = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? cur;
  const rising = cur > prev + 0.01;
  const color = inAlarm ? "var(--lvl-high)" : "var(--brand)";

  return (
    <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[12px] font-semibold tracking-wider text-ink">{sp}</span>
        <span className="tnum text-[12px]" style={{ color: inAlarm ? "var(--lvl-high)" : "var(--ink-bright, var(--text-bright))" }}>
          {cur.toFixed(1)}
          <span className="ml-1 text-[9px] text-ink-dim">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="overflow-visible">
        {/* threshold line */}
        <line x1="0" y1={ty} x2={w} y2={ty} stroke="var(--lvl-watch)" strokeWidth="1" strokeDasharray="3 3" opacity="0.55" />
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
        />
      </svg>
      <div className="flex items-center justify-between">
        <span className="label !text-[8px]">
          {cfg.invert ? "min" : "alarm"} {cfg.threshold}
        </span>
        <span className="font-mono text-[9px]" style={{ color: rising ? "var(--lvl-elevated)" : "var(--text-dim)" }}>
          {rising ? "▲ rising" : "— stable"}
        </span>
      </div>
    </div>
  );
}

export function TelemetryStrip({
  history,
  zoneId,
  thresholds,
}: {
  history: Frame[];
  zoneId: string | null;
  thresholds: Record<string, Threshold>;
}) {
  const series: Record<string, number[]> = {};
  GAS_ORDER.forEach((sp) => (series[sp] = []));
  let unitMap: Record<string, string> = {};
  let alarmMap: Record<string, boolean> = {};

  for (const f of history) {
    const z = f.zones.find((zz) => zz.id === zoneId);
    if (!z) continue;
    for (const sp of GAS_ORDER) {
      const g = z.gases[sp];
      if (g) {
        series[sp].push(g.value);
        unitMap[sp] = g.unit;
        alarmMap[sp] = !!g.stage;
      }
    }
  }

  return (
    <div className="hud-panel">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2">
        <span className="label">Atmosphere · {zoneId ?? "—"}</span>
        <span className="label !text-[8px]">live telemetry</span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-line">
        {GAS_ORDER.map((sp) => (
          <Spark
            key={sp}
            sp={sp}
            values={series[sp]}
            cfg={cfgFor(sp, thresholds[sp], series[sp])}
            unit={unitMap[sp] ?? ""}
            inAlarm={alarmMap[sp] ?? false}
          />
        ))}
      </div>
    </div>
  );
}
