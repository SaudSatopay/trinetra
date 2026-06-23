"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getFrames, getPlant, getScenarios, getSimulate, getIncident, IncidentReplay, getExternal, ExternalReplay, SimConfig, API_BASE } from "@/lib/api";
import { Frame, MainView, Plant, ScenarioInfo, Zone } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { PlantSchematic } from "@/components/PlantSchematic";
import { ThreatPanel } from "@/components/ThreatPanel";
import { DualStatus } from "@/components/DualStatus";
import { Player } from "@/components/Player";
import { ScenarioEditor } from "@/components/ScenarioEditor";
import { Connector } from "@/components/Connector";
import { Logo } from "@/components/Logo";
import { CCTVTile } from "@/components/CCTVTile";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { FleetView } from "@/components/FleetView";
import { boothAudio, BOOTH_STEPS, EVAC_LINE } from "@/lib/booth";

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
  const [mainView, setMainView] = useState<MainView>("plant");
  const [error, setError] = useState<string | null>(null);
  const [ingestSummary, setIngestSummary] = useState<string | null>(null);
  const [incident, setIncident] = useState<IncidentReplay | null>(null);
  const [external, setExternal] = useState<ExternalReplay | null>(null);
  const prevScenario = useRef("");
  const wantMoneyShot = useRef(false);
  const [boothOn, setBoothOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [boothStep, setBoothStep] = useState(0);
  const beatArmed = useRef(false);
  const alarmFired = useRef(false);

  const handleIngest = (f: Frame[], summary: string) => {
    prevScenario.current = "ingested";
    setIngestSummary(summary);
    setIncident(null);
    setExternal(null);
    setFrames(f);
    setIndex(0);
    setPlaying(true);
    setSelected(null);
    setScenario("ingested");
  };

  const handleIncident = (d: IncidentReplay) => {
    prevScenario.current = "ingested";
    setIncident(d);
    setExternal(null);
    setIngestSummary(null);
    setFrames(d.frames);
    setIndex(0);
    setPlaying(true);
    setSelected(d.zone);
    setScenario("ingested");
  };

  const handleExternal = (d: ExternalReplay) => {
    prevScenario.current = "ingested";
    setExternal(d);
    setIncident(null);
    setIngestSummary(null);
    setFrames(d.frames);
    setIndex(0);
    setPlaying(true);
    setSelected(d.zone);
    setScenario("ingested");
  };

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
    if (scenario === "ingested") return; // frames are supplied by the connector upload
    setIncident(null); // leaving an ingested feed: drop the stale real-incident context (and its figures)
    setExternal(null);
    setIngestSummary(null);
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
  const playerScenarios = useMemo<ScenarioInfo[]>(() => {
    const list: ScenarioInfo[] = [
      ...scenarios,
      { name: "custom", title: "Custom scenario — you control the factors", description: "",
        expected_compound: false, hazard_zone: "COB-1" },
    ];
    if (scenario === "ingested") {
      list.push({ name: "ingested", title: "Ingested SCADA feed", description: "",
        expected_compound: false, hazard_zone: "COB-1" });
    }
    return list;
  }, [scenarios, scenario]);
  const activeZoneId = selected ?? frame?.summary.top_zone ?? null;
  const activeZone: Zone | null = frame ? frame.zones.find((z) => z.id === activeZoneId) ?? null : null;

  const currentStep = BOOTH_STEPS[boothStep % BOOTH_STEPS.length];
  const suppressAuto = boothOn && mainView !== "plant";
  // surface the spoken evacuation on screen too, so the booth message still lands if the browser's
  // speech synthesis is silent or unavailable (audio is a bonus, not the only channel)
  const boothAlarming = boothOn && currentStep.audio && !!frame?.summary.compound_alert;

  // keep the audio engine's mute flag in sync with the UI
  useEffect(() => {
    boothAudio.setMuted(muted);
  }, [muted]);

  // attract-mode scheduler: stage the current beat, then advance to the next
  useEffect(() => {
    if (!boothOn) return;
    const step = BOOTH_STEPS[boothStep % BOOTH_STEPS.length];
    let cancelled = false;
    beatArmed.current = false;
    alarmFired.current = false;
    setSelected(null);
    setSpeed(4);
    setMainView(step.view);
    if (step.scenario === "texas-city" || step.scenario === "jaipur") {
      getIncident(step.scenario)
        .then((d) => {
          if (!cancelled) handleIncident(d);
        })
        .catch(() => {});
    } else {
      setScenario(step.scenario);
      setIndex(0);
      setPlaying(true);
    }
    const id = window.setTimeout(() => {
      if (!cancelled) setBoothStep((s) => (s + 1) % BOOTH_STEPS.length);
    }, step.dwellMs);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothOn, boothStep]);

  // fire the siren + spoken evacuation once per beat, the moment it goes compound
  // (only after a clean frame, so the prior beat's state cannot trigger it early)
  useEffect(() => {
    if (!boothOn || !currentStep.audio) return;
    const compound = !!frame?.summary.compound_alert;
    if (!compound) {
      beatArmed.current = true;
    } else if (beatArmed.current && !alarmFired.current) {
      alarmFired.current = true;
      boothAudio.alarm(EVAC_LINE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boothOn, boothStep, frame]);

  // silence everything when attract mode ends or the page unmounts
  useEffect(() => {
    if (!boothOn) boothAudio.stop();
  }, [boothOn]);
  useEffect(() => () => boothAudio.stop(), []);

  const toggleBooth = () => {
    setBoothOn((on) => {
      const next = !on;
      if (next) {
        boothAudio.unlock(); // the click is our chance to satisfy autoplay policy
        boothAudio.setMuted(muted);
        setBoothStep(0);
      } else {
        boothAudio.stop();
      }
      return next;
    });
  };
  const toggleMute = () => setMuted((m) => !m);

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
            <span className="font-mono text-brand">uvicorn app.api.server:app</span>
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
    <main className="flex h-screen min-w-[900px] flex-col overflow-hidden">
      <TopBar tMin={frame.t_min} topLevel={frame.summary.top_level} compound={frame.summary.compound_alert} scenario={scenario} zone={activeZoneId ?? undefined} shiftHandover={frame.summary.shift_handover} onJudgeMode={judgeMode} booth={boothOn} muted={muted} onBooth={toggleBooth} onMute={toggleMute} />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-4">
        <div className="stagger-in flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <ErrorBoundary label="Plant schematic unavailable">
            {mainView === "fleet" ? (
              <FleetView view={mainView} onView={setMainView} />
            ) : mainView === "graph" ? (
              <KnowledgeGraph view={mainView} onView={setMainView} />
            ) : (
              <PlantSchematic plant={plant} frame={frame} selected={activeZoneId} onSelect={setSelected} view={mainView} onView={setMainView} />
            )}
          </ErrorBoundary>
          <div className="flex h-[124px] shrink-0 gap-4">
            <CCTVTile />
            <DualStatus frames={frames} index={index} />
          </div>
        </div>
        <div className="stagger-in flex w-[372px] shrink-0 flex-col" style={{ animationDelay: "0.12s" }}>
          <ErrorBoundary label="Threat panel unavailable">
            <ThreatPanel zone={activeZone} thresholds={plant.thresholds} scenario={scenario} tMin={frame.t_min} responseScenario={incident?.key} suppressAuto={suppressAuto} />
          </ErrorBoundary>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {boothOn && (
          <div
            className="hud-panel rise-in flex items-center gap-3 px-5 py-2.5"
            style={{
              borderColor: boothAlarming
                ? "color-mix(in srgb, var(--lvl-critical) 55%, var(--line))"
                : "color-mix(in srgb, var(--brand) 38%, var(--line))",
            }}
          >
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              style={{
                color: boothAlarming ? "var(--lvl-critical)" : "var(--brand)",
                background: boothAlarming
                  ? "color-mix(in srgb, var(--lvl-critical) 16%, transparent)"
                  : "color-mix(in srgb, var(--brand) 14%, transparent)",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full soft-pulse"
                style={{ background: boothAlarming ? "var(--lvl-critical)" : "var(--brand)" }}
              />
              {boothAlarming ? "Evacuation broadcast" : "Attract mode"}
            </span>
            {boothAlarming ? (
              <span className="font-display text-[12px] font-semibold leading-snug" style={{ color: "var(--lvl-critical)" }}>
                “{EVAC_LINE}”
              </span>
            ) : (
              <span className="font-display text-[12px] leading-snug text-ink">{currentStep.label}</span>
            )}
          </div>
        )}
        {scenario === "custom" && (
          <ScenarioEditor
            config={custom}
            onChange={setCustom}
            compoundNow={!!frame?.summary.compound_alert}
          />
        )}
        {scenario === "ingested" && incident && (
          <div
            className="hud-panel flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5"
            style={{ borderColor: "color-mix(in srgb, var(--lvl-high) 40%, var(--line))" }}
          >
            <span
              className="rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              style={{ color: "var(--lvl-high)", background: "color-mix(in srgb, var(--lvl-high) 14%, transparent)" }}
            >
              Real incident
            </span>
            <span className="font-display text-[12.5px] font-semibold text-ink-bright">{incident.incident}</span>
            <span className="font-mono text-[10px] text-ink-dim">{incident.date} · {incident.source}</span>
            {incident.lead_min != null && (
              <span className="font-mono text-[10px]" style={{ color: "var(--brand)" }}>
                Trinetra alert T+{incident.trinetra_alert_min} · documented ignition T+{incident.documented_event_min} →{" "}
                <span className="font-bold">{incident.lead_min} min earlier</span>
              </span>
            )}
            <a
              href={`${API_BASE}/api/incident/${incident.key}.csv`}
              className="font-mono text-[10px] text-ink-dim underline-offset-2 hover:underline"
              title="Download the reconstructed CSV — inspect the inquiry's own sequence"
            >
              source CSV
            </a>
          </div>
        )}
        {scenario === "ingested" && external && (
          <div
            className="hud-panel flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-2.5"
            style={{ borderColor: "color-mix(in srgb, var(--brand) 45%, var(--line))" }}
          >
            <span
              className="rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
              style={{ color: "var(--brand)", background: "color-mix(in srgb, var(--brand) 15%, transparent)" }}
            >
              Real measured data
            </span>
            <span className="font-display text-[12.5px] font-semibold text-ink-bright">{external.dataset}</span>
            <span className="font-mono text-[10px] text-ink-dim">{external.source}</span>
            {external.lead_min != null && (
              <span className="font-mono text-[10px]" style={{ color: "var(--brand)" }}>
                Trinetra alert T+{external.trinetra_alert_min} · single-sensor T+{external.single_sensor_min} →{" "}
                <span className="font-bold">{external.lead_min} min earlier</span>
              </span>
            )}
            <span className="font-mono text-[9px] text-ink-dim" title={`overlaid: ${external.overlaid}`}>
              real: {external.channel} — engine untuned; only the y-scale + permit context are overlaid
            </span>
            <a
              href={`${API_BASE}/api/external/${external.key}.csv`}
              className="font-mono text-[10px] text-ink-dim underline-offset-2 hover:underline"
              title="Download the exact feed the engine ingested — the real measured CO values, scaled to the plant band"
            >
              source CSV
            </a>
          </div>
        )}
        {scenario === "ingested" && !incident && !external && (
          <div className="hud-panel flex items-center gap-3 px-5 py-2.5">
            <span className="label">Ingested SCADA feed</span>
            <span className="font-mono text-[10px] text-ink-dim">
              {ingestSummary} · replayed through the live compound engine, unchanged
            </span>
          </div>
        )}
        <Player
          extra={<Connector onIngest={handleIngest} onIncident={handleIncident} onExternal={handleExternal} />}
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

// The demo "money shot": a beat after the compound alert fires — the alert is live, the legacy
// single-sensor is still blind, and the gas is still visibly below its setpoint (not pinned at the
// alarm line). The lead readout shows the definitive +N (computed from the full run, see DualStatus).
function moneyShotIndex(frames: Frame[]): number {
  const firstCompound = frames.findIndex((f) => f.summary.compound_alert);
  if (firstCompound < 0) return 0;
  const firstBaseline = frames.findIndex((f) => f.summary.baseline_alarm);
  const target = firstCompound + 2;
  return firstBaseline > firstCompound ? Math.min(target, firstBaseline - 1) : Math.min(target, frames.length - 1);
}
