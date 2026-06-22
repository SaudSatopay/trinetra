"use client";

import { useEffect, useMemo, useState } from "react";
import { getFrames, getPlant, getScenarios, API_BASE } from "@/lib/api";
import { Frame, Plant, ScenarioInfo, Zone } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { PlantSchematic } from "@/components/PlantSchematic";
import { ThreatPanel } from "@/components/ThreatPanel";
import { DualStatus } from "@/components/DualStatus";
import { Player } from "@/components/Player";
import { Logo } from "@/components/Logo";

export default function Page() {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState("vizag");
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([getPlant(), getScenarios()]);
        setPlant(p);
        setScenarios(s);
      } catch {
        setError(`Cannot reach the Trinetra API at ${API_BASE}.`);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const f = await getFrames(scenario, 55);
        setFrames(f);
        setIndex(0);
        setPlaying(true);
        setSelected(null);
      } catch {
        setError(`Cannot load frames from ${API_BASE}.`);
      }
    })();
  }, [scenario]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = window.setInterval(() => {
      setIndex((p) => (p + 1 < frames.length ? p + 1 : p));
    }, 1000 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, frames]);

  useEffect(() => {
    if (frames.length > 0 && index >= frames.length - 1) setPlaying(false);
  }, [index, frames]);

  const frame = frames[index] ?? null;
  const history = useMemo(() => frames.slice(0, index + 1), [frames, index]);
  const activeZoneId = selected ?? frame?.summary.top_zone ?? null;
  const activeZone: Zone | null = frame ? frame.zones.find((z) => z.id === activeZoneId) ?? null : null;

  if (error)
    return (
      <Screen>
        <div className="max-w-md text-center">
          <div className="mb-3 font-display text-[15px] text-critical">API unreachable</div>
          <p className="text-[12px] leading-relaxed text-ink-dim">
            {error}
            <br />
            <br />
            Start it from <span className="font-mono text-ink">trinetra/backend</span>:<br />
            <span className="font-mono text-brand">uvicorn app.api.server:app --reload</span>
          </p>
        </div>
      </Screen>
    );
  if (!plant || !frame)
    return (
      <Screen>
        <div className="soft-pulse">
          <Logo size={44} />
        </div>
        <div className="label mt-5">Initializing digital twin…</div>
      </Screen>
    );

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <TopBar tMin={frame.t_min} topLevel={frame.summary.top_level} compound={frame.summary.compound_alert} />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <PlantSchematic plant={plant} frame={frame} selected={activeZoneId} onSelect={setSelected} />
          <DualStatus history={history} />
        </div>
        <div className="flex w-[372px] shrink-0 flex-col">
          <ThreatPanel zone={activeZone} thresholds={plant.thresholds} />
        </div>
      </div>

      <div className="px-4 py-4">
        <Player
          scenarios={scenarios}
          scenario={scenario}
          onScenario={setScenario}
          playing={playing}
          onTogglePlay={() => setPlaying((p) => !p)}
          onReset={() => {
            setIndex(0);
            setPlaying(true);
          }}
          speed={speed}
          onSpeed={setSpeed}
          index={index}
          frames={frames}
          onSeek={(i) => {
            setIndex(i);
            setPlaying(false);
          }}
        />
      </div>
    </main>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return <main className="flex h-screen flex-col items-center justify-center">{children}</main>;
}
