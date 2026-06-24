"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { MainView } from "@/lib/types";
import { ViewToggle } from "./ViewToggle";

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
  permit: "var(--good)",
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

export function KnowledgeGraph({ view, onView }: { view: MainView; onView: (v: MainView) => void }) {
  const [kg, setKg] = useState<KG | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [k, setK] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const st = useRef({ k: 1, tx: 0, ty: 0 });

  useEffect(() => {
    st.current = { k, tx, ty };
  }, [k, tx, ty]);

  useEffect(() => {
    fetch(`${API_BASE}/api/knowledge-graph`)
      .then((r) => r.json())
      .then((d) => !d.error && setKg(d))
      .catch(() => {});
  }, []);

  const toVB = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  // wheel-to-zoom toward the cursor — native non-passive listener so preventDefault works
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x: vx, y: vy } = toVB(e.clientX, e.clientY);
      const { k: pk, tx: ptx, ty: pty } = st.current;
      const nk = Math.min(4.5, Math.max(0.55, pk * (e.deltaY < 0 ? 1.16 : 1 / 1.16)));
      setK(nk);
      setTx(vx - ((vx - ptx) / pk) * nk);
      setTy(vy - ((vy - pty) / pk) * nk);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toVB]);

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx, ty };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const a = svgRef.current?.getScreenCTM()?.a || 1;
    setTx(drag.current.tx + (e.clientX - drag.current.x) / a);
    setTy(drag.current.ty + (e.clientY - drag.current.y) / a);
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const zoom = (f: number) => {
    const { k: pk } = st.current;
    const nk = Math.min(4.5, Math.max(0.55, pk * f));
    // zoom about the centre of the canvas
    setTx((p) => W / 2 - ((W / 2 - p) / pk) * nk);
    setTy((p) => H / 2 - ((H / 2 - p) / pk) * nk);
    setK(nk);
  };
  const reset = () => {
    setK(1);
    setTx(0);
    setTy(0);
  };

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
        <ViewToggle view={view} onView={onView} />
      </div>

      <div className="relative min-h-0 flex-1 p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full touch-none select-none"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        >
          <g transform={`translate(${tx} ${ty}) scale(${k})`}>
            {kg?.edges.map((e, i) => {
              const a = pos[e.source];
              const b = pos[e.target];
              if (!a || !b) return null;
              const toHazard = e.target === HAZARD;
              const lit = !!hover && (e.source === hover || e.target === hover);
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={lit ? "var(--brand)" : toHazard ? "var(--lvl-critical)" : "var(--line-2)"}
                  strokeWidth={lit ? 1.9 : toHazard ? 1.4 : 1}
                  opacity={lit ? 0.92 : toHazard ? 0.45 : hover ? 0.12 : 0.22}
                  style={{ transition: "stroke .15s ease, opacity .15s ease" }}
                />
              );
            })}
            {kg?.nodes.map((n) => {
              const p = pos[n.id];
              if (!p) return null;
              const col = TYPE_COLOR[n.type] ?? "var(--text-dim)";
              const hazard = n.type === "hazard";
              const label = short(n);
              const isH = hover === n.id;
              const w = hazard ? 176 : Math.max(58, label.length * 7 + 18);
              const h = hazard ? 46 : 27;
              const full = n.label.replace(/_/g, " ");
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x} ${p.y}) scale(${isH ? 1.16 : 1})`}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover((cur) => (cur === n.id ? null : cur))}
                  style={{ transition: "transform .18s cubic-bezier(.34,1.3,.5,1)" }}
                >
                  <rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx={hazard ? 9 : 6}
                    fill={`color-mix(in srgb, ${col} ${hazard ? 24 : isH ? 20 : 11}%, var(--panel))`}
                    stroke={col}
                    strokeWidth={isH ? (hazard ? 2.3 : 1.8) : hazard ? 1.7 : 1}
                    style={{
                      filter: hazard || isH ? `drop-shadow(0 0 ${isH ? 15 : 12}px ${col})` : undefined,
                      transition: "fill .15s ease, stroke-width .12s ease",
                    }}
                  />
                  <text
                    x={0}
                    y={0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={hazard ? 12.5 : 10}
                    fontWeight={hazard ? 700 : 500}
                    fill={hazard || isH ? "var(--text-bright)" : "var(--text)"}
                    style={{ fontFamily: "var(--font-mono)", letterSpacing: hazard ? "0.06em" : "0" }}
                  >
                    {label}
                  </text>
                  {isH && full && full.toLowerCase() !== label.toLowerCase() && (
                    <text
                      x={0}
                      y={h / 2 + 10}
                      textAnchor="middle"
                      fontSize={8}
                      fill="var(--text-dim)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {n.type} · {full.length > 44 ? full.slice(0, 44) + "…" : full}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* zoom controls */}
        <div className="absolute right-4 top-4 flex flex-col gap-1.5">
          {([["+", () => zoom(1.25)], ["−", () => zoom(1 / 1.25)]] as [string, () => void][]).map(([t, fn]) => (
            <button
              key={t}
              onClick={fn}
              className="lift flex h-7 w-7 items-center justify-center rounded-md font-mono text-base leading-none"
              style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--text)" }}
            >
              {t}
            </button>
          ))}
          <button
            onClick={reset}
            className="lift flex h-7 w-7 items-center justify-center rounded-md font-mono text-[8px] uppercase tracking-wider"
            style={{ background: "var(--panel)", border: "1px solid var(--line-2)", color: "var(--text-dim)" }}
          >
            fit
          </button>
        </div>
        <span
          className="pointer-events-none absolute bottom-3 left-5 font-mono text-[9px]"
          style={{ color: "color-mix(in srgb, var(--text-dim) 70%, transparent)" }}
        >
          scroll to zoom · drag to pan{Math.abs(k - 1) > 0.01 ? ` · ${k.toFixed(1)}×` : ""}
        </span>
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
