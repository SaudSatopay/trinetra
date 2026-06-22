"use client";

import { useState } from "react";
import { API_BASE } from "@/lib/api";

interface ResponseData {
  zone_name: string;
  level: string;
  auto_executed: boolean;
  actions: string[];
  incident_report: string;
  alert: Record<string, string>;
  evidence: { sensor_snapshot: string; cctv: string; permits: string[] };
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
    <div className="border-t border-line pt-4">
      <button
        onClick={openModal}
        className="flex w-full items-center justify-between rounded-lg px-3.5 py-3 transition-colors hover:brightness-125"
        style={{
          background: "color-mix(in srgb, var(--lvl-critical) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--lvl-critical) 32%, transparent)",
        }}
      >
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full soft-pulse" style={{ background: "var(--lvl-critical)" }} />
          <span className="font-display text-[13px] font-semibold" style={{ color: "var(--lvl-critical)" }}>
            Autonomous response initiated
          </span>
        </span>
        <span className="font-mono text-[10px] text-ink-dim">view →</span>
      </button>
      {open && <Modal data={data} loading={loading} onClose={() => setOpen(false)} />}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(2,5,8,0.78)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="hud-panel flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden"
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
          </div>
          <button onClick={onClose} className="text-ink-dim transition-colors hover:text-ink">
            ✕
          </button>
        </div>

        {loading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <span className="label soft-pulse">orchestrating response…</span>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.15fr] divide-x divide-line overflow-hidden">
            <div className="space-y-6 overflow-y-auto p-6">
              <div>
                <div className="label mb-3">Actions executed</div>
                <ul className="space-y-2.5">
                  {data.actions.map((a, i) => (
                    <li key={i} className="flex gap-2 text-[12px] leading-snug text-ink">
                      <span style={{ color: "var(--brand)" }}>✓</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

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
      </div>
    </div>
  );
}
