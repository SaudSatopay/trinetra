"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

interface MemMatch {
  title: string;
  date: string;
  location: string;
  casualties: string;
  source: string;
  similarity: number;
}
interface MemData {
  briefing: string;
  matches: MemMatch[];
  analysis_mode?: "live" | "cached";
}

export function DisasterMemory({
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
  const [data, setData] = useState<MemData | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!active) {
      setData(null);
      setState("idle");
      return;
    }
    let cancelled = false;
    setState("loading");
    setData(null);
    const mins = Math.max(12, Math.round(tMin));
    fetch(`${API_BASE}/api/disaster-memory?scenario=${scenario}&zone=${zoneId}&minutes=${mins}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error || !d.matches) setState("error");
        else {
          setData(d);
          setState("idle");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // refetch only when the zone/scenario/active state changes, not every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, scenario, zoneId]);

  if (!active) return null;
  const top = data?.matches?.[0];

  return (
    <div className="border-t border-line pt-4">
      <div className="label mb-3 flex items-center gap-2">
        Disaster memory
        {state === "loading" && (
          <span className="soft-pulse text-ink-dim" style={{ textTransform: "none", letterSpacing: "normal" }}>
            · matching precedent…
          </span>
        )}
        {data?.analysis_mode === "cached" && (
          <span
            className="rounded px-1.5 py-0.5 font-mono text-[8px] text-ink-dim"
            style={{ border: "1px solid var(--line-2)", textTransform: "none", letterSpacing: "normal" }}
            title="Live model rate-limited — showing verified cached analysis"
          >
            cached
          </span>
        )}
      </div>

      {top && (
        <div
          className="rounded-lg p-3.5"
          style={{
            background: "color-mix(in srgb, var(--lvl-critical) 7%, transparent)",
            border: "1px solid color-mix(in srgb, var(--lvl-critical) 26%, transparent)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-[12.5px] font-medium leading-snug text-ink-bright">{top.title}</span>
            <span className="tnum shrink-0 text-[15px] font-semibold" style={{ color: "var(--lvl-critical)" }}>
              {Math.round(top.similarity * 100)}%
            </span>
          </div>
          <div className="mt-1 font-mono text-[9px] text-ink-dim">
            {top.date} · {top.location} · {top.casualties}
          </div>
          {data?.briefing && <p className="mt-3 text-[11.5px] leading-relaxed text-ink">{data.briefing}</p>}
          {data && data.matches.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.matches.slice(1).map((m, i) => (
                <span
                  key={i}
                  className="rounded px-1.5 py-0.5 font-mono text-[8px] text-ink-dim"
                  style={{ border: "1px solid var(--line-2)" }}
                >
                  {Math.round(m.similarity * 100)}% · {m.title.split(" ").slice(0, 3).join(" ")}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2.5 font-mono text-[8px] text-ink-dim">source · {top.source}</div>
        </div>
      )}
      {state === "error" && <div className="text-[11px] text-ink-dim">Precedent analysis unavailable.</div>}
    </div>
  );
}
