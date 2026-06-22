import { Zone } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { RiskGauge } from "./RiskGauge";

export function ThreatPanel({ zone }: { zone: Zone | null }) {
  if (!zone) {
    return (
      <div className="hud-panel flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="label">Active Threat</span>
        <div className="font-display text-[16px] tracking-wide text-ink-dim">ALL ZONES NOMINAL</div>
      </div>
    );
  }

  const r = zone.risk;
  const col = levelColor[r.level];
  const top = r.interventions[0];
  const rest = r.interventions.slice(1);

  return (
    <div className="hud-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="label">Active Threat</span>
        <span className="font-display text-[13px] font-bold tracking-wide" style={{ color: col }}>
          {zone.id} · {zone.name}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* gauge */}
        <div className="flex items-center justify-center">
          <RiskGauge score={r.score} level={r.level} />
        </div>

        {/* compound banner */}
        {r.compound && (
          <div
            className="animate-rise-in flex items-center gap-2.5 border px-3 py-2.5"
            style={{ borderColor: "var(--lvl-critical)", background: "color-mix(in srgb, var(--lvl-critical) 12%, transparent)" }}
          >
            <span className="text-[18px]" style={{ color: "var(--lvl-critical)" }}>◣</span>
            <div>
              <div className="font-display text-[13px] font-bold tracking-wide" style={{ color: "var(--lvl-critical)" }}>
                COMPOUND HAZARD
              </div>
              <div className="text-[10px] text-ink-dim">lethal combination — invisible to single sensors</div>
            </div>
          </div>
        )}

        {/* time to threshold */}
        {r.time_to_threshold_min !== null && (
          <div className="border border-line bg-bg-2/60 px-3 py-2.5">
            <div className="label">Projected Breach</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tnum text-[28px] font-semibold leading-none" style={{ color: "var(--lvl-elevated)" }}>
                ~{Math.round(r.time_to_threshold_min)}
              </span>
              <span className="label">min at current rate</span>
            </div>
          </div>
        )}

        {/* factors */}
        <div>
          <div className="label mb-2">Contributing Factors</div>
          <ul className="space-y-1.5">
            {r.factors.length === 0 && <li className="text-[11px] text-ink-dim">— none —</li>}
            {r.factors.map((f, i) => (
              <li key={i} className="flex gap-2 text-[11.5px] leading-snug text-ink">
                <span className="mt-[3px] text-[8px]" style={{ color: col }}>◆</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* interventions */}
        {top && (
          <div>
            <div className="label mb-2">Recommended Action</div>
            <div className="border px-3 py-2.5" style={{ borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 9%, transparent)" }}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[12.5px] font-semibold leading-snug text-ink-bright">{top.action}</span>
                <span className="tnum shrink-0 text-[13px] font-semibold" style={{ color: "var(--brand)" }}>−{Math.round(top.delta)}%</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-ink-dim">
                <span>RISK →</span>
                <span style={{ color: levelColor[top.resulting_level] }}>{levelLabel[top.resulting_level]}</span>
              </div>
            </div>

            {rest.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {rest.map((iv, i) => (
                  <div key={i} className="flex items-center justify-between border border-line px-3 py-1.5">
                    <span className="text-[11px] text-ink">{iv.action}</span>
                    <span className="tnum text-[11px] text-ink-dim">−{Math.round(iv.delta)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
