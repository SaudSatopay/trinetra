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
from ..ai.disaster_memory import DisasterMemory, condition_from_factors
from ..engine import CompoundRiskEngine
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
    try:
        matches = _memory.match(condition, k=3)
        briefing = _memory.briefing(condition, matches[0])
    except Exception as e:  # Gemini/network hiccup — fail soft so the UI degrades gracefully
        return {"error": f"analysis unavailable: {e}"}

    result = {
        "condition": condition,
        "briefing": briefing,
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
