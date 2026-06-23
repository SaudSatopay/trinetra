"use client";

import { useRef, useState } from "react";
import { API_BASE, ExternalReplay, getExternal, getIncident, IncidentReplay, ingestCsv } from "@/lib/api";
import { Frame } from "@/lib/types";

export function Connector({
  onIngest,
  onIncident,
  onExternal,
}: {
  onIngest: (frames: Frame[], summary: string) => void;
  onIncident: (d: IncidentReplay) => void;
  onExternal: (d: ExternalReplay) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const replayIncident = async (name: string) => {
    setErr(null);
    setBusy(true);
    try {
      onIncident(await getIncident(name));
    } catch (x) {
      setErr(String(x instanceof Error ? x.message : x).slice(0, 60));
    } finally {
      setBusy(false);
    }
  };

  const replayExternal = async (key: string) => {
    setErr(null);
    setBusy(true);
    try {
      onExternal(await getExternal(key));
    } catch (x) {
      setErr(String(x instanceof Error ? x.message : x).slice(0, 60));
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const { frames, summary } = await ingestCsv(await f.text());
      onIngest(frames, summary);
    } catch (x) {
      setErr(String(x instanceof Error ? x.message : x).slice(0, 60));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-ink-dim">connector</span>
      <input ref={ref} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
      <button
        onClick={() => ref.current?.click()}
        className="rounded-md px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
        style={{
          color: "var(--brand)",
          border: "1px solid color-mix(in srgb, var(--brand) 32%, transparent)",
          background: "color-mix(in srgb, var(--brand) 8%, transparent)",
        }}
        title="Replay a SCADA/permit CSV through the live engine"
      >
        {busy ? "ingesting…" : "Ingest CSV"}
      </button>
      <a
        href={`${API_BASE}/api/ingest/sample`}
        className="font-mono text-[10px] text-ink-dim underline-offset-2 hover:underline"
        title="Download a sample SCADA CSV (Vizag scenario exported as a feed)"
      >
        sample
      </a>
      <span className="h-4 w-px bg-line-2" />
      <button
        onClick={() => replayIncident("texas-city")}
        disabled={busy}
        className="rounded-md px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
        style={{
          color: "var(--lvl-high)",
          border: "1px solid color-mix(in srgb, var(--lvl-high) 38%, transparent)",
          background: "color-mix(in srgb, var(--lvl-high) 9%, transparent)",
        }}
        title="Replay the real BP Texas City (2005) incident, reconstructed from the U.S. CSB report"
      >
        Texas City · CSB ’05
      </button>
      <button
        onClick={() => replayIncident("jaipur")}
        disabled={busy}
        className="rounded-md px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
        style={{
          color: "var(--lvl-high)",
          border: "1px solid color-mix(in srgb, var(--lvl-high) 38%, transparent)",
          background: "color-mix(in srgb, var(--lvl-high) 9%, transparent)",
        }}
        title="Replay the real Indian Oil Jaipur (2009) depot fire, reconstructed from the MB Lal Committee report"
      >
        Jaipur · MB Lal ’09
      </button>
      <span className="h-4 w-px bg-line-2" />
      <button
        onClick={() => replayExternal("air-quality")}
        disabled={busy}
        className="rounded-md px-2.5 py-1.5 text-[11px] transition-colors hover:brightness-125"
        style={{
          color: "var(--brand)",
          border: "1px solid color-mix(in srgb, var(--brand) 42%, transparent)",
          background: "color-mix(in srgb, var(--brand) 10%, transparent)",
        }}
        title="Replay REAL measured CO data (UCI #360, De Vito 2008) the engine never authored — same connector, zero tuning"
      >
        Air Quality · De Vito ’08
      </button>
      {err && (
        <span className="font-mono text-[9px]" style={{ color: "var(--lvl-high)" }}>
          · {err}
        </span>
      )}
    </div>
  );
}
