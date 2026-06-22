"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { API_BASE } from "@/lib/api";
import { AnimatedNumber } from "./AnimatedNumber";

interface ImpactItem {
  key: string;
  label: string;
  value_cr: number;
  basis: string;
}
interface Impact {
  currency: string;
  total_cr: number;
  items: ImpactItem[];
  fatalities_at_risk: number;
  precedent_toll: number;
  system_cost_annual_cr: number;
  payback_years: number;
}
interface TimelineEvent {
  t: number;
  label: string;
  kind: string;
}
interface ResponseData {
  zone_name: string;
  level: string;
  auto_executed: boolean;
  analysis_mode?: "live" | "cached";
  impact?: Impact;
  evidence_timeline?: TimelineEvent[];
  actions: string[];
  incident_report: string;
  alert: Record<string, string>;
  evidence: { sensor_snapshot: string; cctv: string; permits: string[] };
}

function kindColor(kind: string): string {
  switch (kind) {
    case "trinetra":
      return "var(--brand)";
    case "legacy":
      return "var(--legacy)";
    case "ignition":
      return "var(--lvl-high)";
    default:
      return "var(--lvl-watch)"; // personnel
  }
}

export function ResponseTrigger({
  scenario,
  zoneId,
  tMin,
  active,
}: {
  scenario: string;
  zoneId: string;
  tMin: number;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);

  if (!active) return null;

  const openModal = () => {
    setOpen(true);
    if (!data && !loading) {
      setLoading(true);
      const mins = Math.max(12, Math.round(tMin));
      fetch(`${API_BASE}/api/response?scenario=${scenario}&zone=${zoneId}&minutes=${mins}`)
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) setData(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  return (
    <div className="rise-in border-t border-line pt-4">
      <button
        onClick={openModal}
        className="relative flex w-full items-center justify-between rounded-lg px-3.5 py-3 transition-colors hover:brightness-125"
        style={{
          background: "color-mix(in srgb, var(--lvl-critical) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--lvl-critical) 32%, transparent)",
        }}
      >
        <span
          className="attn-ring pointer-events-none absolute inset-0 rounded-lg"
          style={{ border: "1px solid var(--lvl-critical)" }}
        />
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-critical)" }} />
          <span className="font-display text-[13px] font-semibold" style={{ color: "var(--lvl-critical)" }}>
            Autonomous response initiated
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim">view →</span>
      </button>
      <AnimatePresence>
        {open && <Modal key="resp-modal" data={data} loading={loading} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Modal({
  data,
  loading,
  onClose,
}: {
  data: ResponseData | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [lang, setLang] = useState("English");
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(640px 460px at 50% 46%, rgba(251,59,78,0.12), transparent 62%), rgba(2,5,8,0.82)",
        backdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <span
        className="shockwave pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full"
        style={{ border: "2px solid var(--lvl-critical)" }}
      />
      <span
        className="shockwave pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] rounded-full"
        style={{ border: "2px solid var(--lvl-critical)", animationDelay: "0.13s" }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
        className="response-charge hud-panel flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-[15px] font-semibold text-ink-bright">Autonomous Response</span>
            {data?.auto_executed && (
              <span
                className="rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider"
                style={{ background: "color-mix(in srgb, var(--lvl-critical) 14%, transparent)", color: "var(--lvl-critical)" }}
              >
                auto-initiated
              </span>
            )}
            {data?.analysis_mode === "cached" && (
              <span
                className="rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider"
                style={{ background: "color-mix(in srgb, var(--text-dim) 12%, transparent)", color: "var(--text-dim)" }}
                title="Live model rate-limited — showing verified cached analysis"
              >
                cached
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-ink-dim transition-colors hover:text-ink">
            ✕
          </button>
        </div>

        {data?.impact && (
          <div
            className="border-b border-line px-6 py-4"
            style={{ background: "color-mix(in srgb, var(--brand) 6%, transparent)" }}
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="label mb-1">Avoided loss · prevented incident</div>
                <div className="font-display text-[30px] font-bold leading-none" style={{ color: "var(--brand)" }}>
                  <AnimatedNumber value={data.impact.total_cr} from={0} decimals={1} duration={0.9} prefix="₹" suffix=" Cr" />
                </div>
              </div>
              <div className="text-right font-mono text-[10px] leading-relaxed text-ink-dim">
                {data.impact.fatalities_at_risk} personnel in zone · precedent killed {data.impact.precedent_toll}
                <br />
                platform ₹{data.impact.system_cost_annual_cr} Cr/yr → {data.impact.payback_years}× return
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {data.impact.items.map((it, i) => (
                <span key={i} className="font-mono text-[10px] text-ink-dim" title={it.basis}>
                  {it.label.replace(/\s*\(.*\)/, "")} <span className="text-ink-bright">₹{it.value_cr} Cr</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {loading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <span className="label soft-pulse">orchestrating response…</span>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.15fr] divide-x divide-line overflow-hidden">
            <div className="space-y-6 overflow-y-auto p-6">
              <div>
                <div className="label mb-3">Actions executed</div>
                <motion.ul
                  className="space-y-2.5"
                  initial="hidden"
                  animate="show"
                  variants={{ show: { transition: { delayChildren: 0.18, staggerChildren: 0.1 } } }}
                >
                  {data.actions.map((a, i) => (
                    <motion.li
                      key={i}
                      className="flex gap-2 text-[12px] leading-snug text-ink"
                      variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                    >
                      <motion.span
                        style={{ color: "var(--brand)" }}
                        variants={{ hidden: { scale: 0 }, show: { scale: 1 } }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                      >
                        ✓
                      </motion.span>
                      <span>{a}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>

              {data.evidence_timeline && data.evidence_timeline.length > 0 && (
                <div>
                  <div className="label mb-3">Sequence of events</div>
                  <ol className="space-y-2.5 border-l pl-4" style={{ borderColor: "var(--line-2)" }}>
                    {data.evidence_timeline.map((e, i) => (
                      <li key={i} className="relative">
                        <span
                          className="absolute -left-[21px] top-[5px] h-2 w-2 rounded-full"
                          style={{ background: kindColor(e.kind), boxShadow: `0 0 6px ${kindColor(e.kind)}` }}
                        />
                        <div className="flex items-baseline gap-2">
                          <span className="tnum text-[11px]" style={{ color: kindColor(e.kind) }}>
                            T+{String(e.t).padStart(2, "0")}
                          </span>
                          <span className="text-[11.5px] leading-snug text-ink">{e.label}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <div>
                <div className="label mb-2 flex items-center justify-between">
                  Evacuation alert
                  <span className="flex gap-1">
                    {Object.keys(data.alert).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className="rounded px-1.5 py-0.5 font-mono text-[9px]"
                        style={{
                          color: l === lang ? "var(--brand)" : "var(--text-dim)",
                          background: l === lang ? "color-mix(in srgb, var(--brand) 12%, transparent)" : "transparent",
                        }}
                      >
                        {l}
                      </button>
                    ))}
                  </span>
                </div>
                <p
                  className="rounded-lg p-3 text-[12px] leading-relaxed text-ink-bright"
                  style={{ background: "color-mix(in srgb, var(--lvl-elevated) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--lvl-elevated) 24%, transparent)" }}
                >
                  {data.alert[lang]}
                </p>
              </div>

              <div>
                <div className="label mb-2">Evidence preserved</div>
                <ul className="space-y-1 font-mono text-[10px] text-ink-dim">
                  <li>· {data.evidence.sensor_snapshot}</li>
                  <li>· CCTV {data.evidence.cctv}</li>
                  <li>· permits {data.evidence.permits.join(", ")}</li>
                </ul>
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="label px-6 pt-6">Auto-drafted incident report</div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">
                <pre className="whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-ink">
                  {data.incident_report.replace(/\*\*/g, "")}
                </pre>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
