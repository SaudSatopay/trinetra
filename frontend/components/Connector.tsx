"use client";

import { useRef, useState } from "react";
import { API_BASE, ingestCsv } from "@/lib/api";
import { Frame } from "@/lib/types";

export function Connector({ onIngest }: { onIngest: (frames: Frame[], summary: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      {err && (
        <span className="font-mono text-[9px]" style={{ color: "var(--lvl-high)" }}>
          · {err}
        </span>
      )}
    </div>
  );
}
