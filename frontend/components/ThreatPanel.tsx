import { Gas, Threshold, Zone } from "@/lib/types";
import { levelColor, levelLabel, GAS_ORDER } from "@/lib/risk";
import { RiskGauge } from "./RiskGauge";
import { DisasterMemory } from "./DisasterMemory";
import { ResponseTrigger } from "./ResponseTrigger";
import { AnimatedNumber } from "./AnimatedNumber";

export function ThreatPanel({
  zone,
  thresholds,
  scenario,
  tMin,
}: {
  zone: Zone | null;
  thresholds: Record<string, Threshold>;
  scenario: string;
  tMin: number;
}) {
  if (!zone) {
    return (
      <div className="hud-panel flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="label">Active threat</span>
        <div className="font-display text-[15px] tracking-wide text-ink-dim">All zones nominal</div>
      </div>
    );
  }

  const r = zone.risk;
  const col = levelColor[r.level];
  const top = r.interventions[0];
  const rest = r.interventions.slice(1, 3);

  return (
    <div className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <span className="label">Active threat</span>
        {r.compound && (
          <span
            className="rise-in flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{ background: "color-mix(in srgb, var(--lvl-critical) 13%, transparent)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-critical)" }} />
            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--lvl-critical)" }}>
              Compound hazard
            </span>
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* zone + gauge */}
        <div className="flex flex-col items-center gap-3">
          <RiskGauge score={r.score} level={r.level} size={150} />
          <div className="text-center">
            <div className="font-display text-[15px] font-semibold tracking-wide text-ink-bright">{zone.id}</div>
            <div className="text-[11px] text-ink-dim">{zone.name}</div>
          </div>
        </div>

        {/* breach */}
        {r.time_to_threshold_min !== null && (
          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="label">Projected breach</span>
            <span className="tnum text-[18px]" style={{ color: "var(--lvl-elevated)" }}>
              <AnimatedNumber value={r.time_to_threshold_min} prefix="~" duration={0.5} />
              {r.ttt_spread ? <span className="ml-0.5 text-[11px] text-ink-dim">±{r.ttt_spread}</span> : null}
              <span className="ml-1 text-[10px] text-ink-dim">min</span>
            </span>
          </div>
        )}

        {/* calibrated confidence — quantified uncertainty over the sensor-noise model */}
        {r.compound && r.confidence != null && (
          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span
              className="label"
              title="Probability the compound verdict holds when every reading is jittered by its sensor's own noise (128-draw Monte Carlo)"
            >
              Alert confidence
            </span>
            <span className="tnum text-[18px]" style={{ color: "var(--brand)" }}>
              <AnimatedNumber value={Math.round(r.confidence * 100)} suffix="%" duration={0.5} />
            </span>
          </div>
        )}

        <DisasterMemory scenario={scenario} zoneId={zone.id} tMin={tMin} active={r.compound && scenario !== "custom" && scenario !== "ingested"} />

        {/* factors */}
        {r.factors.length > 0 && (
          <div className="border-t border-line pt-4">
            <div className="label mb-3">Why</div>
            <ul className="space-y-2.5">
              {r.factors.slice(0, 4).map((f, i) => (
                <li key={i} className="flex gap-2.5 text-[12px] leading-snug text-ink">
                  <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full" style={{ background: col }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* recommended action */}
        {top && (
          <div className="border-t border-line pt-4">
            <div className="label mb-3">Recommended action</div>
            <div
              className="card-hover rounded-lg p-3.5"
              style={{ background: "color-mix(in srgb, var(--brand) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 35%, transparent)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-medium leading-snug text-ink-bright">{top.action}</span>
                <span className="tnum shrink-0 text-[14px] font-semibold" style={{ color: "var(--brand)" }}>
                  <AnimatedNumber value={top.delta} prefix="−" suffix="%" />
                </span>
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-ink-dim">
                risk → <span style={{ color: levelColor[top.resulting_level] }}>{levelLabel[top.resulting_level]}</span>
              </div>
            </div>
            {rest.map((iv, i) => (
              <div key={i} className="flex items-center justify-between px-1 pt-2.5 text-[11.5px] text-ink-dim">
                <span>{iv.action}</span>
                <span className="tnum">
                  <AnimatedNumber value={iv.delta} prefix="−" suffix="%" />
                </span>
              </div>
            ))}
          </div>
        )}

        <ResponseTrigger
          scenario={scenario}
          zoneId={zone.id}
          tMin={tMin}
          active={r.compound && scenario !== "custom" && scenario !== "ingested"}
          auto={r.compound && r.level === "critical" && scenario !== "custom" && scenario !== "ingested"}
        />

        {/* atmosphere */}
        <div className="border-t border-line pt-4">
          <div className="label mb-3">Atmosphere</div>
          <div className="space-y-2.5">
            {GAS_ORDER.map((sp) => (
              <GasBar key={sp} sp={sp} gas={zone.gases[sp]} thr={thresholds[sp]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GasBar({ sp, gas, thr }: { sp: string; gas?: Gas; thr?: Threshold }) {
  if (!gas) return null;
  const pct =
    sp === "O2"
      ? Math.min(100, Math.max(0, ((20.9 - gas.value) / (20.9 - 16)) * 100))
      : Math.min(100, (gas.value / (thr?.low ?? 1)) * 100);
  const inAlarm = !!gas.stage;
  const col = inAlarm ? "var(--lvl-high)" : "var(--brand)";
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 font-display text-[11px] text-ink">{sp}</span>
      <div className="relative h-1 flex-1 overflow-hidden rounded-full" style={{ background: "var(--line-2)" }}>
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: col }} />
      </div>
      <span className="tnum w-16 text-right text-[11px]" style={{ color: inAlarm ? "var(--lvl-high)" : "var(--text)" }}>
        {gas.value.toFixed(1)}
        <span className="ml-1 text-[8px] text-ink-dim">{gas.unit}</span>
      </span>
    </div>
  );
}
