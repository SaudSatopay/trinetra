"use client";

import { useEffect, useState } from "react";
import { getFleet } from "@/lib/api";
import { FleetOverview, FleetSite, Level, MainView } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { ViewToggle } from "./ViewToggle";

const inAlert = (l: Level) => l === "elevated" || l === "high" || l === "critical";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label !text-[8.5px]">{label}</span>
      <span className="tnum text-[22px] leading-none" style={{ color: accent ?? "var(--text-bright)" }}>
        {value}
      </span>
    </div>
  );
}

function SiteRow({ s }: { s: FleetSite }) {
  const color = levelColor[s.level];
  const alert = inAlert(s.level);
  return (
    <div
      className="lift group flex flex-col rounded-md py-2.5 pr-3"
      style={{
        background: alert ? `color-mix(in srgb, ${color} 7%, var(--panel-2))` : "var(--panel-2)",
        border: `1px solid ${alert ? `color-mix(in srgb, ${color} 30%, var(--line))` : "var(--line)"}`,
      }}
    >
      <div className="flex items-stretch gap-3">
        <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[13px] font-semibold text-ink-bright">{s.name}</span>
            {s.compound && (
              <span
                className="shrink-0 rounded px-1.5 py-px font-mono text-[8.5px] font-bold uppercase tracking-wider"
                style={{ color: "var(--lvl-critical)", background: "color-mix(in srgb, var(--lvl-critical) 16%, transparent)" }}
              >
                Compound
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ink-dim">
            <span>{s.location}</span>
            <span className="opacity-40">·</span>
            <span>{s.type}</span>
            {alert && (
              <>
                <span className="opacity-40">·</span>
                <span style={{ color: "color-mix(in srgb, " + color + " 80%, var(--text))" }}>{s.worst_zone_name}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4 text-right">
          {s.exposed > 0 && (
            <div className="flex flex-col items-end">
              <span className="tnum text-[14px]" style={{ color: "var(--lvl-critical)" }}>{s.exposed}</span>
              <span className="label !text-[8px]">exposed</span>
            </div>
          )}
          {s.lead_min != null && (
            <div className="flex flex-col items-end">
              <span className="tnum text-[14px]" style={{ color: "var(--brand)" }}>+{s.lead_min}m</span>
              <span className="label !text-[8px]">lead</span>
            </div>
          )}
          <div className="flex w-[78px] flex-col items-end">
            <span className="tnum text-[15px]" style={{ color }}>{s.score.toFixed(0)}</span>
            <span className="font-mono text-[8.5px] font-semibold uppercase tracking-wider" style={{ color }}>
              {levelLabel[s.level]}
            </span>
          </div>
        </div>
      </div>

      {/* hover reveal — the per-site detail behind the headline */}
      <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-300 ease-out group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100">
        <div
          className="ml-4 flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t pt-1.5 font-mono text-[8.5px] text-ink-dim"
          style={{ borderColor: "var(--line)" }}
        >
          <span>now T+{s.now_min}</span>
          {s.trinetra_alert_min != null && <span style={{ color: "var(--good)" }}>Trinetra T+{s.trinetra_alert_min}</span>}
          {s.single_sensor_min != null && <span style={{ color: "var(--legacy)" }}>single-sensor T+{s.single_sensor_min}</span>}
          <span>{s.workers} on shift</span>
          {s.compound_zones > 0 && (
            <span style={{ color: "var(--lvl-critical)" }}>
              {s.compound_zones} compound zone{s.compound_zones > 1 ? "s" : ""}
            </span>
          )}
          <span className="capitalize">{s.scenario.replace(/_/g, " ")}</span>
        </div>
      </div>
    </div>
  );
}

export function FleetView({ view, onView }: { view: MainView; onView: (v: MainView) => void }) {
  const [data, setData] = useState<FleetOverview | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    getFleet().then(setData).catch(() => setErr(true));
  }, []);

  const f = data?.fleet;

  return (
    <div className="hud-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-baseline gap-3">
          <span className="label">Fleet Command</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-dim">
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--brand)" }} />
            {f ? `${f.sites} plants · ${f.workers_monitored} workers · one engine, live` : "loading…"}
          </span>
        </div>
        <ViewToggle view={view} onView={onView} />
      </div>

      {err && (
        <div className="flex flex-1 items-center justify-center font-mono text-[11px] text-ink-dim">
          Fleet endpoint unavailable.
        </div>
      )}

      {f && (
        <div className="grid grid-cols-5 gap-3 px-6 py-4">
          <Stat label="Sites online" value={String(f.sites)} />
          <Stat label="In alert" value={String(f.in_alert)} accent={f.in_alert ? "var(--lvl-elevated)" : undefined} />
          <Stat label="Compound now" value={String(f.compound_alerts)} accent={f.compound_alerts ? "var(--lvl-critical)" : undefined} />
          <Stat label="Workers exposed" value={String(f.workers_exposed)} accent={f.workers_exposed ? "var(--lvl-critical)" : undefined} />
          <Stat label="Max lead" value={f.max_lead_min != null ? `${f.max_lead_min}m` : "—"} accent="var(--brand)" />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-3">
        {data?.sites.map((s) => <SiteRow key={s.id} s={s} />)}
      </div>

      {data && (
        <div className="border-t border-line px-6 py-2.5 font-mono text-[9.5px] leading-relaxed text-ink-dim">
          {data.scale.engine} · {data.scale.per_site}. {data.scale.note}.
        </div>
      )}
    </div>
  );
}
