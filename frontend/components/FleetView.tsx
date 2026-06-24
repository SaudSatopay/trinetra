"use client";

import { useEffect, useState } from "react";
import { getFleet, getFleetScale } from "@/lib/api";
import { FleetOverview, FleetScale, FleetSite, Level, MainView } from "@/lib/types";
import { levelColor, levelLabel } from "@/lib/risk";
import { ViewToggle } from "./ViewToggle";

const inAlert = (l: Level) => l === "elevated" || l === "high" || l === "critical";
const fmt = (n: number) => n.toLocaleString("en-US");

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

/** Measured scale economics — timed, not asserted. One headline line + an expandable
 *  $/plant cost curve, the unit-economics slide a VC reads in five seconds. */
function ScaleBand({ sc }: { sc: FleetScale }) {
  const [open, setOpen] = useState(false);
  const m = sc.measured;
  const p = sc.provisioning;
  return (
    <div className="mx-6 mb-1 rounded-md" style={{ border: "1px solid var(--line-2)", background: "var(--panel-2)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="tappable flex w-full items-center gap-x-3 gap-y-1 px-3.5 py-2.5 text-left"
      >
        <span
          className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.12em]"
          style={{ color: "var(--good)", background: "color-mix(in srgb, var(--good) 12%, transparent)" }}
        >
          Measured
        </span>
        <span className="flex flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5 font-mono text-[10.5px] text-ink-dim">
          <span className="text-ink">
            <b className="tnum text-ink-bright">{p.cores_for_fleet}</b> core{p.cores_for_fleet > 1 ? "s" : ""}
          </span>
          <span className="opacity-40">·</span>
          <span><b className="tnum text-ink-bright">{fmt(m.assessments_per_sec)}</b> plant-assessments/s</span>
          <span className="opacity-40">·</span>
          <span>p50 <b className="tnum text-ink-bright">{m.p50_ms.toFixed(2)} ms</b></span>
          <span className="opacity-40">·</span>
          <span><b className="tnum text-ink-bright">{fmt(sc.total_sensors)}</b> sensors</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="tnum text-[15px] font-semibold" style={{ color: "var(--good)" }}>
            ${p.fleet_per_plant_usd_mo.toFixed(2)}
          </span>
          <span className="ml-1 font-mono text-[9px] text-ink-dim">/plant/mo</span>
        </span>
        <span className="shrink-0 font-mono text-[10px] text-ink-dim transition-transform duration-300" style={{ transform: open ? "rotate(90deg)" : "none" }}>
          ▸
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-400 ease-out"
        style={{ maxHeight: open ? 320 : 0, opacity: open ? 1 : 0 }}
      >
        <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--line)" }}>
          <table className="w-full font-mono text-[10px]">
            <thead>
              <tr className="label !text-[8px]" style={{ color: "var(--text-dim)" }}>
                <th className="pb-1.5 text-left font-semibold">Fleet</th>
                <th className="pb-1.5 text-right font-semibold">Cores</th>
                <th className="pb-1.5 text-right font-semibold">Total $/mo</th>
                <th className="pb-1.5 text-right font-semibold">$/plant/mo</th>
              </tr>
            </thead>
            <tbody>
              {sc.cost_curve.map((r) => (
                <tr key={r.plants} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-1 text-left text-ink">{fmt(r.plants)} plants</td>
                  <td className="py-1 text-right tnum text-ink-dim">{r.cores}</td>
                  <td className="py-1 text-right tnum text-ink-dim">${fmt(r.total_usd_mo)}</td>
                  <td className="py-1 text-right tnum font-semibold" style={{ color: "var(--good)" }}>
                    ${r.per_plant_usd_mo.toFixed(r.per_plant_usd_mo < 0.1 ? 3 : 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2.5 leading-relaxed">
            <p className="font-mono text-[8.5px]" style={{ color: "var(--good)" }}>{sc.shard}</p>
            <p className="mt-1 font-mono text-[8px] text-ink-dim">{sc.basis}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FleetView({ view, onView }: { view: MainView; onView: (v: MainView) => void }) {
  const [data, setData] = useState<FleetOverview | null>(null);
  const [scale, setScale] = useState<FleetScale | null>(null);
  const [err, setErr] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getFleet().then(setData).catch(() => setErr(true));
    getFleetScale().then(setScale).catch(() => {});
  }, []);

  const f = data?.fleet;
  const sites = data?.sites ?? [];
  const alertSites = sites.filter((s) => inAlert(s.level));
  const calmSites = sites.filter((s) => !inAlert(s.level));

  return (
    <div className="hud-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-baseline gap-3">
          <span className="label">Fleet Command</span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-dim">
            <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--brand)" }} />
            {f ? `${f.sites} plants · ${fmt(f.zones_monitored)} zones · one engine, live` : "loading…"}
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
          <Stat label="Compound now" value={String(f.compound_sites)} accent={f.compound_sites ? "var(--lvl-critical)" : undefined} />
          <Stat label="Workers exposed" value={String(f.workers_exposed)} accent={f.workers_exposed ? "var(--lvl-critical)" : undefined} />
          <Stat label="Max lead" value={f.max_lead_min != null ? `${f.max_lead_min}m` : "—"} accent="var(--brand)" />
        </div>
      )}

      {scale && <ScaleBand sc={scale} />}

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pb-3 pt-2">
        {alertSites.map((s) => <SiteRow key={s.id} s={s} />)}

        {calmSites.length > 0 && (
          <>
            <button
              onClick={() => setShowAll((v) => !v)}
              className="tappable flex items-center justify-between rounded-md px-3 py-2 text-left"
              style={{ border: "1px dashed var(--line-2)", background: "var(--panel-2)" }}
            >
              <span className="flex items-center gap-2 font-mono text-[10px] text-ink-dim">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--good)" }} />
                <b className="tnum text-ink">{calmSites.length}</b> nominal site{calmSites.length > 1 ? "s" : ""} · all clear, monitored live
              </span>
              <span className="font-mono text-[9px] text-ink-dim">{showAll ? "hide ▾" : "show all ▸"}</span>
            </button>
            {showAll && calmSites.map((s) => <SiteRow key={s.id} s={s} />)}
          </>
        )}
      </div>

      {data && (
        <div className="border-t border-line px-6 py-2.5 font-mono text-[9.5px] leading-relaxed text-ink-dim">
          {data.scale.engine} · {data.scale.per_site}. {data.scale.note}.
        </div>
      )}
    </div>
  );
}
