"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getJSON } from "@/lib/api";

interface Tick {
  t: number;
  ch4: number;
  compound: boolean;
  score: number;
  latency_ms: number;
}
interface Session {
  available: boolean;
  protocol?: string;
  endpoint?: string;
  tags?: string[];
  ticks?: Tick[];
  alert_min?: number | null;
  single_sensor_min?: number | null;
  lead_min?: number | null;
  p50_ms?: number;
  p99_ms?: number;
}

function Step({ label, tone }: { label: string; tone?: "brand" | "crit" }) {
  const color = tone === "crit" ? "var(--lvl-critical)" : tone === "brand" ? "var(--brand)" : "var(--text)";
  return (
    <span className="rounded px-1.5 py-0.5" style={{ border: "1px solid var(--line-2)", color }}>
      {label}
    </span>
  );
}

/** A live OPC-UA ingest badge: the protocol a real SCADA/DCS exposes, straight into the engine.
 *  Click for the architecture flow, the per-tick tape, and the read->decide latency. */
export function LiveIngest() {
  const [s, setS] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJSON<Session>("/api/opcua/session")
      .then((d) => {
        if (!cancelled) setS(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!s || !s.available) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="tappable flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-wider"
        style={{
          color: "var(--good)",
          border: "1px solid color-mix(in srgb, var(--good) 34%, transparent)",
          background: "color-mix(in srgb, var(--good) 8%, transparent)",
        }}
        title="Live OPC-UA ingest — the protocol a real SCADA/DCS exposes, read straight into the engine"
      >
        <span className="soft-pulse h-1.5 w-1.5 rounded-full" style={{ background: "var(--good)" }} />
        OPC‑UA · {s.p50_ms}ms
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-6"
            style={{ background: "rgba(6,4,3,0.72)" }}
            onClick={() => setOpen(false)}
          >
            <div className="hud-panel rise-in w-[580px] max-w-full p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-[15px] font-semibold text-ink-bright">Live OPC‑UA ingest</div>
                  <div className="mt-0.5 font-mono text-[9px] text-ink-dim">{s.endpoint}</div>
                </div>
                <button onClick={() => setOpen(false)} className="tappable text-ink-dim hover:text-ink">
                  ✕
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 font-mono text-[9px] text-ink-dim">
                <Step label="Plant PLC" />
                <span>→</span>
                <Step label="OPC‑UA opc.tcp" tone="brand" />
                <span>→</span>
                <Step label="Trinetra client" />
                <span>→</span>
                <Step label="Compound engine" />
                <span>→</span>
                <Step label="Alert" tone="crit" />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                <span style={{ color: "var(--good)" }}>
                  compound alert <b>T+{s.alert_min}</b>
                </span>
                <span className="text-ink-dim">
                  vs single‑sensor T+{s.single_sensor_min} (
                  <b style={{ color: "var(--good)" }}>+{s.lead_min} min earlier</b>)
                </span>
                <span className="ml-auto font-mono text-ink-dim">
                  read→decide p50 <b className="text-ink-bright">{s.p50_ms} ms</b> · p99 {s.p99_ms} ms
                </span>
              </div>

              <div className="mt-3 max-h-48 overflow-auto rounded-md" style={{ border: "1px solid var(--line)" }}>
                {(s.ticks || []).map((tk) => (
                  <div
                    key={tk.t}
                    className="flex items-center gap-3 px-3 py-1 font-mono text-[10px]"
                    style={{
                      borderBottom: "1px solid var(--line)",
                      background: tk.compound ? "color-mix(in srgb, var(--lvl-critical) 7%, transparent)" : "transparent",
                    }}
                  >
                    <span className="w-10 text-ink-dim">T+{tk.t}</span>
                    <span className="w-28">CH4 {tk.ch4} %LEL</span>
                    <span className="w-16">score {tk.score}</span>
                    <span className="w-16 text-ink-dim">{tk.latency_ms} ms</span>
                    {tk.compound && (
                      <span className="ml-auto" style={{ color: "var(--lvl-critical)" }}>
                        COMPOUND
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-2 font-mono text-[8.5px] leading-relaxed text-ink-dim">
                tags: {(s.tags || []).join(" · ")} — every value the engine acts on came off the wire.
                Self‑contained: an in‑process OPC‑UA server, no external broker. A live RTSP/historian feed
                is the same client pointed at the plant.
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
