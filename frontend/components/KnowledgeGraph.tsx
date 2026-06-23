"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

interface KGNode {
  id: string;
  type: string;
  label: string;
}
interface KGEdge {
  source: string;
  target: string;
  rel: string;
}
interface KG {
  nodes: KGNode[];
  edges: KGEdge[];
  stats: { nodes: number; edges: number };
}

const W = 1120;
const H = 600;
const HAZARD = "HZ:coke-oven-explosion";

const TYPE_COLOR: Record<string, string> = {
  hazard: "var(--lvl-critical)",
  precursor: "var(--brand)",
  gas: "var(--lvl-watch)",
  permit: "var(--lvl-normal)",
  incident: "var(--text-dim)",
  zone: "var(--lvl-elevated)",
};

// readable short labels (the raw labels are long full titles)
const SHORT: Record<string, string> = {
  "PC:flammable-rising": "Flammable gas ↑",
  "PC:ignition": "Ignition source",
  "PC:personnel": "Personnel",
  "PC:confined-o2": "Confined · O₂",
  "HZ:coke-oven-explosion": "COMPOUND HAZARD",
  "PT:hot_work": "Hot work",
  "PT:electrical_isolation": "Electrical",
  "PT:confined_space_entry": "Confined entry",
  "PT:maintenance": "Maintenance",
  "IN:vizag-coke-2025": "Vizag coke-oven",
  "IN:piper-alpha-1988": "Piper Alpha",
  "IN:texas-city-2005": "Texas City",
  "IN:hotwork-flammable-generic": "Hot-work ignition",
  "IN:confined-h2s-o2-generic": "Confined H₂S",
  "IN:lg-polymers-2020": "LG Polymers",
  "IN:ioc-jaipur-2009": "IOC Jaipur",
  "IN:nlc-neyveli-2020": "NLC Neyveli",
};

const LEGEND: [string, string][] = [
  ["gas", "Gas"],
  ["permit", "Permit"],
  ["precursor", "Precursor"],
  ["hazard", "Hazard"],
  ["incident", "Precedent"],
  ["zone", "Zone"],
];

function short(n: KGNode): string {
  if (SHORT[n.id]) return SHORT[n.id];
  if (n.type === "zone") return n.id.replace("ZN:", "");
  return n.label.replace(/_/g, " ");
}

function layout(nodes: KGNode[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const of = (t: string) => nodes.filter((n) => n.type === t);
  const spread = (arr: KGNode[], x: number, y0: number, y1: number) =>
    arr.forEach((n, i) => {
      pos[n.id] = { x, y: arr.length <= 1 ? (y0 + y1) / 2 : y0 + ((y1 - y0) * i) / (arr.length - 1) };
    });
  spread(of("gas"), 80, 70, 250);
  spread(of("permit"), 250, 70, 250);
  spread(of("precursor"), 510, 80, 330);
  spread(of("hazard"), 770, 205, 205);
  spread(of("incident"), 1000, 40, 380);
  const zones = of("zone");
  zones.forEach((n, i) => {
    pos[n.id] = { x: 130 + (i * (W - 260)) / Math.max(1, zones.length - 1), y: 545 };
  });
  return pos;
}

export function KnowledgeGraph({ onToggle }: { onToggle: () => void }) {
  const [kg, setKg] = useState<KG | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/knowledge-graph`)
      .then((r) => r.json())
      .then((d) => !d.error && setKg(d))
      .catch(() => {});
  }, []);

  const pos = kg ? layout(kg.nodes) : {};

  return (
    <div className="hud-panel relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <div className="flex items-baseline gap-3">
          <span className="label">Knowledge Graph</span>
          <span className="font-mono text-[10px] text-ink-dim">
            {kg ? `${kg.stats.nodes} nodes · ${kg.stats.edges} edges · how Trinetra reasons` : "loading…"}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-dim transition-colors hover:text-ink"
          style={{ border: "1px solid var(--line-2)" }}
        >
          ← Plant
        </button>
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full">
          {kg?.edges.map((e, i) => {
            const a = pos[e.source];
            const b = pos[e.target];
            if (!a || !b) return null;
            const toHazard = e.target === HAZARD;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={toHazard ? "var(--lvl-critical)" : "var(--line-2)"}
                strokeWidth={toHazard ? 1.4 : 1}
                opacity={toHazard ? 0.45 : 0.22}
              />
            );
          })}
          {kg?.nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const col = TYPE_COLOR[n.type] ?? "var(--text-dim)";
            const hazard = n.type === "hazard";
            const label = short(n);
            const w = hazard ? 176 : Math.max(58, label.length * 7 + 18);
            const h = hazard ? 46 : 27;
            return (
              <g key={n.id} transform={`translate(${p.x - w / 2}, ${p.y - h / 2})`}>
                <title>{n.label}</title>
                <rect
                  width={w}
                  height={h}
                  rx={hazard ? 9 : 6}
                  fill={`color-mix(in srgb, ${col} ${hazard ? 24 : 11}%, var(--panel))`}
                  stroke={col}
                  strokeWidth={hazard ? 1.7 : 1}
                  style={hazard ? { filter: `drop-shadow(0 0 12px ${col})` } : undefined}
                />
                <text
                  x={w / 2}
                  y={h / 2 + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={hazard ? 12.5 : 10}
                  fontWeight={hazard ? 700 : 500}
                  fill={hazard ? "var(--text-bright)" : "var(--text)"}
                  style={{ fontFamily: "var(--font-mono)", letterSpacing: hazard ? "0.06em" : "0" }}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-6 py-2.5">
        {LEGEND.map(([t, l]) => (
          <span key={t} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-ink-dim">
            <span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
