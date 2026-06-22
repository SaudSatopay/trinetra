"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFrames, getPlant, getScenarios, getSimulate, SimConfig, API_BASE } from "@/lib/api";
import { Frame, Plant, ScenarioInfo, Zone } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { PlantSchematic } from "@/components/PlantSchematic";
import { ThreatPanel } from "@/components/ThreatPanel";
import { DualStatus } from "@/components/DualStatus";
import { Player } from "@/components/Player";
import { ScenarioEditor } from "@/components/ScenarioEditor";
import { Logo } from "@/components/Logo";
import { CCTVTile } from "@/components/CCTVTile";

export default function Page() {
  const [plant, setPlant] = useState<Plant | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState("vizag");
  const [custom, setCustom] = useState<SimConfig>({
    zone: "COB-1", gas: "CH4", leak: true, ignition: true, adjacent: false, workers: 3,
  });
  const [frames, setFrames] = useState<Frame[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevScenario = useRef("");
  const wantMoneyShot = useRef(false);

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
    let cancelled = false;
    (async () => {
      try {
        const f = scenario === "custom" ? await getSimulate(custom, 55) : await getFrames(scenario, 55);
        if (cancelled) return;
        setFrames(f);
        if (prevScenario.current !== scenario) {
          setSelected(null);
          prevScenario.current = scenario;
          if (wantMoneyShot.current) {
            // judge mode: land on the money shot (legacy still blind, Trinetra alerting)
            wantMoneyShot.current = false;
            setIndex(moneyShotIndex(f));
            setPlaying(false);
          } else {
            setIndex(0);
            setPlaying(true);
          }
        } else {
          // a custom toggle changed: hold the clock so the effect is visible at the same moment
          setIndex((i) => Math.min(i, Math.max(0, f.length - 1)));
          setPlaying(false);
        }
      } catch {
        if (!cancelled) setError(`Cannot load frames from ${API_BASE}.`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scenario, custom]);

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
  const playerScenarios = useMemo<ScenarioInfo[]>(
    () => [
      ...scenarios,
      { name: "custom", title: "Custom scenario — you control the factors", description: "",
        expected_compound: false, hazard_zone: "COB-1" },
    ],
    [scenarios],
  );
  const activeZoneId = selected ?? frame?.summary.top_zone ?? null;
  const activeZone: Zone | null = frame ? frame.zones.find((z) => z.id === activeZoneId) ?? null : null;

  const judgeMode = () => {
    setSpeed(4);
    setSelected(null);
    if (scenario === "vizag" && frames.length) {
      setIndex(moneyShotIndex(frames));
      setPlaying(false);
    } else {
      wantMoneyShot.current = true;
      setScenario("vizag");
    }
  };

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
      <TopBar tMin={frame.t_min} topLevel={frame.summary.top_level} compound={frame.summary.compound_alert} onJudgeMode={judgeMode} />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <PlantSchematic plant={plant} frame={frame} selected={activeZoneId} onSelect={setSelected} />
          <div className="flex h-[124px] shrink-0 gap-4">
            <CCTVTile />
            <DualStatus history={history} />
          </div>
        </div>
        <div className="flex w-[372px] shrink-0 flex-col">
          <ThreatPanel zone={activeZone} thresholds={plant.thresholds} scenario={scenario} tMin={frame.t_min} />
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {scenario === "custom" && (
          <ScenarioEditor
            config={custom}
            onChange={setCustom}
            compoundNow={!!frame?.summary.compound_alert}
          />
        )}
        <Player
          scenarios={playerScenarios}
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

// The demo "money shot": legacy single-sensor still blind, Trinetra already alerting.
function moneyShotIndex(frames: Frame[]): number {
  const firstBaseline = frames.findIndex((f) => f.summary.baseline_alarm);
  if (firstBaseline > 0) return firstBaseline - 1;
  const firstCompound = frames.findIndex((f) => f.summary.compound_alert);
  return firstCompound >= 0 ? Math.min(firstCompound + 3, frames.length - 1) : 0;
}
