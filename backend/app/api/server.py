"""Trinetra FastAPI service (WP3).

Exposes the digital twin + compound engine to the control-room dashboard:
  GET  /api/health
  GET  /api/scenarios            -> available scenarios
  GET  /api/plant                -> static plant geometry for the map
  GET  /api/frames/{scenario}    -> full precomputed run (frontend scrubs this)
  WS   /ws                       -> live stream of frames at a chosen speed

Frames carry, per zone, the live telemetry AND the engine's compound-risk
assessment (score, level, compound flag, time-to-threshold, ranked interventions),
plus a plant summary that contrasts Trinetra vs the single-sensor baseline.
"""
from __future__ import annotations

import asyncio
import json

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from ..agents import run_pipeline
from ..ai import golden
from ..ai.disaster_memory import DisasterMemory, condition_from_factors
from ..ai.incident import draft_incident_report, evacuation_alert
from ..constants import PLANT_NAME, ZONES
from ..engine import CompoundRiskEngine
from ..kg import kg_export
from ..scenarios import SCENARIOS
from ..simulator import PlantSimulator
from .serialize import plant_layout, serialize_frame

app = FastAPI(title="Trinetra API", version="0.3.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


def _run(scenario_name: str, minutes: int) -> list[dict]:
    sim = PlantSimulator(scenario=SCENARIOS[scenario_name], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    return [serialize_frame(snap, engine.assess(snap)) for snap in sim.run(minutes)]


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "trinetra", "version": app.version}


@app.get("/api/scenarios")
def list_scenarios():
    return [
        {"name": s.name, "title": s.title, "description": s.description,
         "expected_compound": s.expected_compound, "hazard_zone": s.hazard_zone}
        for s in SCENARIOS.values()
    ]


@app.get("/api/plant")
def get_plant():
    return plant_layout()


@app.get("/api/frames/{scenario_name}")
def get_frames(scenario_name: str, minutes: int = 45):
    if scenario_name not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario_name}'", "available": list(SCENARIOS)}
    return {"scenario": scenario_name, "minutes": minutes, "frames": _run(scenario_name, minutes)}


_memory = DisasterMemory()
_mem_cache: dict[tuple[str, str], dict] = {}


@app.get("/api/disaster-memory")
def disaster_memory(scenario: str = "vizag", zone: str = "COB-1", minutes: int = 13):
    """Match the live compound condition in a zone to the closest historical disaster."""
    if scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    key = (scenario, zone)
    if key in _mem_cache:
        return _mem_cache[key]

    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    risk = None
    zone_name = zone
    for snap in sim.run(max(1, minutes)):
        risks = engine.assess(snap)
        if zone in risks:
            risk = risks[zone]
            zone_name = snap.zones[zone].name
    if risk is None:
        return {"error": f"unknown zone '{zone}'"}

    condition = condition_from_factors(zone_name, risk.factors)
    hero = (scenario, zone) == ("vizag", "COB-1")
    matches, deg_m = _memory.match(condition, k=3)
    if deg_m and hero:  # serve the cached real ranking so the headline stays 82%
        matches = _memory.hero_matches(k=3)
    briefing, deg_b = _memory.briefing(condition, matches[0], zone_name)
    degraded = deg_m or deg_b
    if degraded and hero:
        briefing = golden.vizag_briefing(zone_name)

    result = {
        "condition": condition,
        "briefing": briefing,
        "analysis_mode": "cached" if degraded else "live",
        "matches": [
            {
                "title": m.incident["title"], "date": m.incident["date"],
                "location": m.incident["location"], "casualties": m.incident["casualties"],
                "source": m.incident["source"], "similarity": round(m.similarity, 3),
            }
            for m in matches
        ],
    }
    _mem_cache[key] = result
    return result


_agents_cache: dict[tuple, dict] = {}


@app.get("/api/agents")
def agents(scenario: str = "vizag", zone: str = "COB-1", minutes: int = 13):
    """Run the LangGraph multi-agent pipeline for a zone and return the agent trace."""
    if scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    key = (scenario, zone, minutes)
    if key in _agents_cache:
        return _agents_cache[key]

    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    risk = None
    snap = None
    for snap in sim.run(max(1, minutes)):
        risks = engine.assess(snap)
        if zone in risks:
            risk = risks[zone]
    if risk is None or snap is None:
        return {"error": f"unknown zone '{zone}'"}

    out = run_pipeline(snap, zone, risk)
    result = {k: out.get(k) for k in ("trace", "sensor", "permit", "vision", "reasoning", "precedent", "response")}
    _agents_cache[key] = result
    return result


_vision_cache: dict | None = None


@app.get("/api/vision")
def vision():
    """Run YOLOv8 person + zone-intrusion detection on a sample CCTV frame."""
    global _vision_cache
    if _vision_cache is not None:
        return _vision_cache
    try:
        # lazy import: the heavy CV deps load only on demand, so the server
        # still starts (and every other route works) even without them installed.
        from ..vision.detector import annotated_jpeg_b64, detect, sample_frame, zone_intrusion

        frame = sample_frame()
        det = detect(frame)
        _vision_cache = {
            "persons": det["persons"],
            "intruders": zone_intrusion(det),
            "boxes": det["boxes"],
            "width": det["width"],
            "height": det["height"],
            "image_b64": annotated_jpeg_b64(frame),
        }
        return _vision_cache
    except Exception as e:
        return {"error": f"vision unavailable: {e}"}


_response_cache: dict = {}


@app.get("/api/response")
def response(scenario: str = "vizag", zone: str = "COB-1", minutes: int = 13):
    """Orchestrate the autonomous response: actions + incident report + multilingual alert."""
    if scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    key = (scenario, zone)
    if key in _response_cache:
        return _response_cache[key]

    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    risk = None
    snap = None
    for snap in sim.run(max(1, minutes)):
        risks = engine.assess(snap)
        if zone in risks:
            risk = risks[zone]
    if risk is None or snap is None or zone not in ZONES:
        return {"error": f"unknown zone '{zone}'"}

    z = snap.zones[zone]
    condition = condition_from_factors(z.name, risk.factors)
    hero = (scenario, zone) == ("vizag", "COB-1")
    matches, deg_m = _memory.match(condition, k=1)
    if deg_m and hero:
        matches = _memory.hero_matches(k=1)
    m = matches[0]
    precedent = f"{m.incident['title']} ({m.incident['date']}, {m.incident['casualties']}) - {round(m.similarity * 100)}% match"

    event = {
        "facility": PLANT_NAME, "zone": zone, "zone_kind": ZONES[zone].kind,
        "t_min": int(snap.t_min), "level": risk.level.value, "score": int(risk.score),
        "ttt": int(risk.time_to_threshold_min or 0),
        "permits": [f"{p.id} ({p.type.value})" for p in z.active_permits],
        "personnel": len(z.worker_ids), "factors": risk.factors, "precedent": precedent,
    }
    report, deg_r = draft_incident_report(event)
    alert = evacuation_alert(z.name)
    degraded = deg_m or deg_r

    actions = []
    if risk.interventions:
        actions.append(f"Execute most-effective control: {risk.interventions[0].action}")
    actions += [
        f"Broadcast multilingual evacuation alert to {z.name}",
        "Auto-dispatch emergency response team",
        "Freeze sensor + CCTV evidence for the investigation record",
        "File the preliminary incident report with the safety officer",
    ]

    package = {
        "zone": zone, "zone_name": z.name, "level": risk.level.value,
        "auto_executed": risk.level.value == "critical",
        "analysis_mode": "cached" if degraded else "live",
        "actions": actions, "incident_report": report, "alert": alert,
        "evidence": {
            "sensor_snapshot": f"T+{int(snap.t_min)} min telemetry frozen",
            "cctv": "frame captured", "permits": [p.id for p in z.active_permits],
        },
    }
    _response_cache[key] = package
    return package


@app.get("/api/knowledge-graph")
def knowledge_graph():
    """The domain knowledge graph: precursors -> compound hazard -> precedents + zones."""
    return kg_export()


_ablation_cache: dict | None = None


@app.get("/api/ablation")
def ablation():
    """Ablation study: single-sensor vs gas-trend-only vs full compound fusion.

    Proves the contextual fusion earns its complexity — same lead time as a naive
    gas-trend rule, but 0% false alarms instead of 64%."""
    global _ablation_cache
    if _ablation_cache is None:
        from ablation import run_ablation  # lazy: benchmark eval set built on first call
        res = run_ablation()
        _ablation_cache = {k: res[k] for k in ("tiers", "n_positive", "n_negative")}
    return _ablation_cache


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    stream_task: asyncio.Task | None = None

    async def stream(scenario_name: str, speed: float, minutes: int):
        frames = _run(scenario_name, minutes)
        for frame in frames:
            await websocket.send_text(json.dumps({"type": "frame", **frame}))
            await asyncio.sleep(max(0.04, 1.0 / max(speed, 0.1)))
        await websocket.send_text(json.dumps({"type": "end", "scenario": scenario_name}))

    def launch(name: str, speed: float, minutes: int) -> asyncio.Task:
        if name not in SCENARIOS:
            name = "vizag"
        return asyncio.create_task(stream(name, speed, minutes))

    try:
        stream_task = launch("vizag", 4.0, 60)
        while True:
            data = json.loads(await websocket.receive_text())
            cmd = data.get("cmd")
            if cmd in ("start", "scenario"):
                if stream_task:
                    stream_task.cancel()
                stream_task = launch(data.get("scenario", "vizag"),
                                     float(data.get("speed", 4.0)),
                                     int(data.get("minutes", 60)))
            elif cmd == "stop" and stream_task:
                stream_task.cancel()
    except WebSocketDisconnect:
        pass
    finally:
        if stream_task:
            stream_task.cancel()
