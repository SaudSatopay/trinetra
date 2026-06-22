"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { API_BASE } from "@/lib/api";

interface ComplianceItem {
  requirement: string;
  regulation: string;
  status: "ok" | "deviation";
  detail: string;
  corrective: string;
  zone: string;
}
interface Compliance {
  items: ComplianceItem[];
  summary: { total: number; deviations: number; compliant: number };
}
interface Pattern {
  label: string;
  occurrences: number;
  severity: number;
  regulation: string;
  prevention: string;
  examples: string[];
}
interface Patterns {
  corpus_size: number;
  incidents: number;
  near_misses: number;
  patterns: Pattern[];
  briefing: string;
}
interface PremortemFinding {
  zone_name: string;
  gas: string;
  cross_zone: boolean;
  t_critical: number;
  exposed: number;
  blast_radius_zones: number;
  blast_zones: string[];
  summary: string;
}
interface Premortem {
  explored: number;
  n_hazard: number;
  n_cross_zone: number;
  n_cleared: number;
  findings: PremortemFinding[];
  note: string;
}
interface AgentsTrace {
  trace: string[];
  reasoning: { compound: boolean; score: number; level: string; factors: string[]; top_intervention: string };
  precedent: { title: string; similarity: number; casualties: string };
}

export function SafetyIntelligence({
  scenario,
  tMin,
  compound,
  zone,
}: {
  scenario: string;
  tMin: number;
  compound: boolean;
  zone?: string;
}) {
  const [comp, setComp] = useState<Compliance | null>(null);
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [premortem, setPremortem] = useState<Premortem | null>(null);
  const [reasoning, setReasoning] = useState<AgentsTrace | null>(null);
  const [open, setOpen] = useState<null | "compliance" | "patterns" | "premortem" | "reasoning">(null);
  const known = scenario !== "custom" && scenario !== "ingested";

  // re-audit on scenario change and when the plant escalates into compound
  useEffect(() => {
    if (!known) {
      setComp(null);
      return;
    }
    const mins = Math.max(12, Math.round(tMin));
    fetch(`${API_BASE}/api/compliance?scenario=${scenario}&minutes=${mins}`)
      .then((r) => r.json())
      .then((d) => !d.error && setComp(d))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, compound, known]);

  useEffect(() => {
    fetch(`${API_BASE}/api/patterns`)
      .then((r) => r.json())
      .then((d) => !d.error && setPatterns(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/premortem`)
      .then((r) => r.json())
      .then((d) => !d.error && setPremortem(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!known || !zone) {
      setReasoning(null);
      return;
    }
    const mins = Math.max(12, Math.round(tMin));
    fetch(`${API_BASE}/api/agents?scenario=${scenario}&zone=${zone}&minutes=${mins}`)
      .then((r) => r.json())
      .then((d) => !d.error && setReasoning(d))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, zone, compound, known]);

  const deviations = known ? comp?.summary.deviations ?? 0 : 0;

  return (
    <>
      <div className="flex items-center gap-2">
        <Chip label="Compliance" onClick={() => setOpen("compliance")} badge={known ? deviations : null} alert={deviations > 0} />
        <Chip label="Patterns" onClick={() => setOpen("patterns")} badge={patterns ? patterns.patterns.length : null} />
        <Chip label="Pre-mortem" onClick={() => setOpen("premortem")} badge={premortem ? premortem.findings.length : null} />
        {known && <Chip label="Reasoning" onClick={() => setOpen("reasoning")} badge={reasoning ? reasoning.trace.length : null} />}
      </div>
      <AnimatePresence>
        {open === "compliance" && <ComplianceModal data={comp} onClose={() => setOpen(null)} />}
        {open === "patterns" && <PatternsModal data={patterns} onClose={() => setOpen(null)} />}
        {open === "premortem" && <PremortemModal data={premortem} onClose={() => setOpen(null)} />}
        {open === "reasoning" && <ReasoningModal data={reasoning} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </>
  );
}

function Chip({ label, onClick, badge, alert }: { label: string; onClick: () => void; badge: number | null; alert?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors hover:brightness-125"
      style={{ color: "var(--text-dim)", border: "1px solid var(--line-2)" }}
    >
      {label}
      {badge !== null && (
        <span
          className="tnum rounded-full px-1.5 text-[9px]"
          style={{
            color: alert ? "var(--lvl-critical)" : "var(--brand)",
            background: `color-mix(in srgb, ${alert ? "var(--lvl-critical)" : "var(--brand)"} 16%, transparent)`,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Shell({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(2,5,8,0.82)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="hud-panel flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div>
            <div className="font-display text-[15px] font-semibold text-ink-bright">{title}</div>
            {sub && <div className="mt-0.5 font-mono text-[10px] text-ink-dim">{sub}</div>}
          </div>
          <button onClick={onClose} className="text-ink-dim transition-colors hover:text-ink">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </motion.div>
    </motion.div>
  );
  return typeof document !== "undefined" ? createPortal(content, document.body) : null;
}

function ComplianceModal({ data, onClose }: { data: Compliance | null; onClose: () => void }) {
  const s = data?.summary;
  return (
    <Shell
      title="Compliance & Audit"
      sub={s ? `${s.deviations} deviation${s.deviations === 1 ? "" : "s"} · ${s.compliant} compliant · OISD / DGMS / Factory Act` : "auditing…"}
      onClose={onClose}
    >
      <div className="space-y-2.5">
        {(data?.items ?? []).map((it, i) => {
          const dev = it.status === "deviation";
          const col = dev ? "var(--lvl-critical)" : "var(--brand)";
          return (
            <div
              key={i}
              className="rounded-lg p-3.5"
              style={{
                background: dev ? "color-mix(in srgb, var(--lvl-critical) 7%, transparent)" : "color-mix(in srgb, var(--brand) 5%, transparent)",
                border: `1px solid color-mix(in srgb, ${col} ${dev ? 26 : 16}%, transparent)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-2 text-[12.5px] font-medium leading-snug text-ink-bright">
                  <span style={{ color: col }}>{dev ? "▲" : "✓"}</span>
                  {it.requirement}
                </span>
                <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] text-ink-dim" style={{ border: "1px solid var(--line-2)" }}>
                  {it.regulation}
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink">{it.detail}</p>
              {dev && it.corrective && (
                <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--brand)" }}>
                  → {it.corrective}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function PatternsModal({ data, onClose }: { data: Patterns | null; onClose: () => void }) {
  return (
    <Shell
      title="Incident Pattern Intelligence"
      sub={data ? `${data.corpus_size} records · ${data.incidents} incidents + ${data.near_misses} near-misses` : "mining…"}
      onClose={onClose}
    >
      {data?.briefing && (
        <p
          className="mb-4 rounded-lg p-3.5 text-[12px] leading-relaxed text-ink-bright"
          style={{ background: "color-mix(in srgb, var(--brand) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 22%, transparent)" }}
        >
          {data.briefing}
        </p>
      )}
      <div className="label mb-3">Recurring patterns · prevention priorities</div>
      <div className="space-y-2.5">
        {(data?.patterns ?? []).map((p, i) => (
          <div key={i} className="rounded-lg p-3.5" style={{ border: "1px solid var(--line-2)" }}>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[12.5px] font-medium leading-snug text-ink-bright">
                <span className="tnum mr-2 text-ink-dim">{i + 1}.</span>
                {p.label}
              </span>
              <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] text-ink-dim" style={{ border: "1px solid var(--line-2)" }}>
                {p.regulation}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 font-mono text-[9px] text-ink-dim">
              <span style={{ color: "var(--lvl-high)" }}>×{p.occurrences} occurrences</span>
              <span>severity {p.severity}/5</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--brand)" }}>
              → {p.prevention}
            </p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function PremortemModal({ data, onClose }: { data: Premortem | null; onClose: () => void }) {
  const tiles: [string, number, string][] = data
    ? [
        ["searched", data.explored, "var(--brand)"],
        ["hazards", data.n_hazard, "var(--lvl-critical)"],
        ["cross-zone", data.n_cross_zone, "var(--lvl-high)"],
        ["cleared", data.n_cleared, "var(--lvl-elevated)"],
      ]
    : [];
  return (
    <Shell
      title="Pre-mortem Hazard Discovery"
      sub={data ? `${data.explored} placements searched — the engine as its own oracle` : "searching…"}
      onClose={onClose}
    >
      {data && (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {tiles.map(([l, n, c], i) => (
              <div key={i} className="rounded-lg p-3 text-center" style={{ border: "1px solid var(--line-2)" }}>
                <div className="tnum text-[22px] font-bold" style={{ color: c }}>
                  {n}
                </div>
                <div className="label !text-[8px] mt-1">{l}</div>
              </div>
            ))}
          </div>
          <p className="mb-4 text-[11px] leading-relaxed text-ink-dim">{data.note}</p>
          <div className="label mb-3">Discovered hazards · ranked by blast radius</div>
          <div className="space-y-2.5">
            {data.findings.map((f, i) => (
              <div
                key={i}
                className="rounded-lg p-3.5"
                style={{
                  background: f.cross_zone ? "color-mix(in srgb, var(--lvl-high) 6%, transparent)" : "transparent",
                  border: `1px solid ${f.cross_zone ? "color-mix(in srgb, var(--lvl-high) 26%, transparent)" : "var(--line-2)"}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[12.5px] font-medium leading-snug text-ink-bright">
                    <span className="tnum mr-2 text-ink-dim">{i + 1}.</span>
                    {f.zone_name} · {f.gas}
                  </span>
                  {f.cross_zone && (
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px]"
                      style={{ color: "var(--lvl-high)", border: "1px solid color-mix(in srgb, var(--lvl-high) 32%, transparent)" }}
                    >
                      cross-zone
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink">{f.summary}</p>
                <div className="mt-1.5 font-mono text-[9px] text-ink-dim">
                  blast radius {f.blast_radius_zones} zones · CRITICAL by T+{f.t_critical} · {f.exposed} exposed
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function ReasoningModal({ data, onClose }: { data: AgentsTrace | null; onClose: () => void }) {
  const stages = (data?.trace ?? []).map((s) => {
    const i = s.indexOf(" - ");
    return i > 0 ? [s.slice(0, i), s.slice(i + 3)] : [s, ""];
  });
  return (
    <Shell
      title="Reasoning trace"
      sub={data ? `6-stage auditable graph — compound ${data.reasoning.compound ? "confirmed" : "not present"}` : "tracing…"}
      onClose={onClose}
    >
      {data && (
        <>
          <ol className="mb-4">
            {stages.map(([name, detail], i) => (
              <li key={i} className="relative border-l pb-4 pl-5 last:border-l-transparent last:pb-0" style={{ borderColor: "var(--line-2)" }}>
                <span
                  className="tnum absolute -left-[9px] top-0 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold"
                  style={{ background: "var(--brand)", color: "#04110d" }}
                >
                  {i + 1}
                </span>
                <div className="font-display text-[12.5px] font-semibold text-ink-bright">{name}</div>
                {detail && <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink">{detail}</div>}
              </li>
            ))}
          </ol>
          <div className="rounded-lg p-3.5" style={{ border: "1px solid var(--line-2)" }}>
            <div className="label mb-2.5">Causal chain · precursors → hazard → precedent</div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
              {data.reasoning.factors.map((f, i) => (
                <span key={i} className="rounded px-2 py-1 text-ink" style={{ background: "color-mix(in srgb, var(--lvl-watch) 14%, transparent)" }}>
                  {f}
                </span>
              ))}
              <span style={{ color: "var(--text-dim)" }}>→</span>
              <span className="rounded px-2 py-1 font-semibold" style={{ background: "color-mix(in srgb, var(--lvl-critical) 14%, transparent)", color: "var(--lvl-critical)" }}>
                COMPOUND {Math.round(data.reasoning.score)}/100
              </span>
              <span style={{ color: "var(--text-dim)" }}>→</span>
              <span className="rounded px-2 py-1" style={{ background: "color-mix(in srgb, var(--brand) 12%, transparent)", color: "var(--brand)" }}>
                {data.precedent.title} · {Math.round(data.precedent.similarity * 100)}%
              </span>
            </div>
          </div>
        </>
      )}
    </Shell>
  );
}
