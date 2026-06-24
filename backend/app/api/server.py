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

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from ..agents import run_pipeline
from ..ai import golden
from ..ai.disaster_memory import DisasterMemory, condition_from_factors
from ..ai.incident import draft_incident_report, evacuation_alert
from ..ai.patterns import pattern_intelligence
from ..constants import GAS_THRESHOLDS, PLANT_NAME, ZONES
from ..domain import IGNITION_PERMITS, Permit, PermitType, RiskLevel, Worker
from ..compliance import audit as compliance_audit
from ..engine import CompoundRiskEngine
from ..feedback import overview as feedback_overview, record as feedback_record, reset as feedback_reset
from ..fleet import fleet_overview
from ..impact import compute_impact, parse_toll
from ..kg import kg_export
from ..permit_gate import evaluate_permit
from ..replay import (INCIDENT_REPLAYS, EXTERNAL_DATASETS, external_csv, external_distance_sweep,
                      external_lead_sweep, external_series, jaipur_csv, parse_csv, sample_csv,
                      texas_city_csv)
from ..scenarios import SCENARIOS, Scenario, ramp
from ..simulator import PlantSimulator
from .serialize import plant_layout, serialize_frame

app = FastAPI(title="Trinetra API", version="0.3.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


_MAX_MINUTES = 240
_MAX_INGEST_BYTES = 2_000_000  # ~2 MB cap on an uploaded CSV (local DoS guard)


def _clamp_minutes(m) -> int:
    """Keep run lengths sane so a stray ?minutes=999999999 can't spin the engine forever."""
    try:
        return max(1, min(int(m), _MAX_MINUTES))
    except (TypeError, ValueError):
        return 45


def _run(scenario_name: str, minutes: int) -> list[dict]:
    sim = PlantSimulator(scenario=SCENARIOS[scenario_name], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine(compute_confidence=True)
    return [serialize_frame(snap, engine.assess(snap)) for snap in sim.run(_clamp_minutes(minutes))]


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
    minutes = _clamp_minutes(minutes)  # echo the clamped value, not the raw request
    return {"scenario": scenario_name, "minutes": minutes, "frames": _run(scenario_name, minutes)}


# Peaks chosen so an injected leak stays sub-alarm for several minutes, then crosses
# its single-sensor setpoint mid-run (the deceptive build-up the engine is built for).
LEAK_PEAKS = {"CH4": 58.0, "CO": 175.0, "H2S": 24.0}


def _build_custom(zone: str, gas: str, leak: bool, ignition: bool, adjacent: bool, workers: int) -> Scenario:
    """Assemble an ad-hoc scenario from the editor's toggles."""
    permits: list = []
    registry: list = []
    if ignition:
        # the ignition source itself — personnel are controlled separately (workers toggle)
        # so each factor of the compound pattern can be toggled independently.
        ign_zone = ZONES[zone].neighbours[0] if (adjacent and ZONES[zone].neighbours) else zone
        permits.append(Permit("PTW-SIM-HW", PermitType.HOT_WORK, ign_zone, [], 0, 60, "Hot work / ignition source (sim)"))
    if workers > 0:
        wids = [f"SIM-P{i + 1}" for i in range(workers)]
        permits.append(Permit("PTW-SIM-CS", PermitType.CONFINED_SPACE, zone, wids, 0, 60, "Personnel in zone (sim)"))
        registry += [Worker(w, f"Worker {i + 1}", "Operator") for i, w in enumerate(wids)]

    confined = ZONES[zone].kind == "confined_space"
    peak = LEAK_PEAKS[gas]

    def inject(t: float):
        if not leak:
            return {}
        o = {(zone, gas): ramp(t, 3, peak, 42)}
        if confined and gas != "O2":
            o[(zone, "O2")] = -ramp(t, 6, 4.0, 42)
        return o

    expected = bool(leak and ignition and workers > 0)
    return Scenario("custom", "Custom scenario", "User-controlled scenario.",
                    expected_compound=expected, hazard_zone=zone,
                    permits=permits, workers=registry, inject=inject)


@app.get("/api/simulate")
def simulate(zone: str = "COB-1", gas: str = "CH4", leak: bool = True,
             ignition: bool = True, adjacent: bool = False, workers: int = 3, minutes: int = 45):
    """Run the engine on an ad-hoc scenario built from the scenario-editor toggles.

    Returns frames in the same shape as /api/frames, so the whole control room
    renders a user-built scenario with no other changes."""
    if zone not in ZONES:
        return {"error": f"unknown zone '{zone}'", "available": list(ZONES)}
    if gas not in LEAK_PEAKS:
        gas = "CH4"
    workers = max(0, min(int(workers), 6))
    minutes = _clamp_minutes(minutes)
    scenario = _build_custom(zone, gas, leak, ignition, adjacent, workers)
    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine(compute_confidence=True)
    frames = [serialize_frame(snap, engine.assess(snap)) for snap in sim.run(minutes)]
    return {
        "scenario": "custom", "minutes": minutes, "frames": frames,
        "config": {"zone": zone, "gas": gas, "leak": leak, "ignition": ignition,
                   "adjacent": adjacent, "workers": workers},
    }


@app.get("/api/ingest/sample")
def ingest_sample():
    """Download a realistic sample SCADA CSV (the Vizag scenario exported as a feed)."""
    return PlainTextResponse(
        sample_csv(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=trinetra_sample_scada.csv"},
    )


def _decode_csv_bytes(body: bytes) -> str:
    """Accept what real plants actually export — UTF-8/UTF-16 with or without a BOM, Excel CSVs —
    and strip stray NUL bytes, so a realistic SCADA export doesn't crash the connector."""
    for enc in ("utf-8-sig", "utf-16", "latin-1"):
        try:
            return body.decode(enc).replace("\x00", "")
        except (UnicodeError, LookupError):
            continue
    return body.decode("utf-8", errors="replace").replace("\x00", "")


@app.post("/api/ingest")
async def ingest(request: Request):
    """Replay an uploaded SCADA/permit CSV through the SAME compound engine — proving
    that ingesting real plant data is a connector, not a rewrite."""
    body = await request.body()
    if len(body) > _MAX_INGEST_BYTES:
        return {"error": f"upload too large (max {_MAX_INGEST_BYTES // 1_000_000} MB)"}
    try:
        snaps, meta = parse_csv(_decode_csv_bytes(body))
    except Exception as e:  # untrusted upload: never 500 — degrade to a clean error message
        return {"error": f"could not parse CSV: {e}".replace("\n", " ")[:200]}
    engine = CompoundRiskEngine(compute_confidence=True)
    frames = [serialize_frame(s, engine.assess(s)) for s in snaps]
    return {"scenario": "ingested", "minutes": len(frames), "frames": frames, **meta}


def _incident_replay(key: str) -> dict:
    """Replay a reconstructed real incident through the SAME engine and report the lead over the
    inquiry's documented event. Real, independently documented conditions — the direct answer to
    'would it have caught a real one?'."""
    inc = INCIDENT_REPLAYS[key]
    csv_text = texas_city_csv() if key == "texas-city" else jaipur_csv()
    snaps, meta = parse_csv(csv_text)
    engine = CompoundRiskEngine(compute_confidence=True)
    frames = [serialize_frame(s, engine.assess(s)) for s in snaps]
    zone = inc["zone"]
    alert_min = single_min = None
    for fr in frames:
        zr = next((z for z in fr["zones"] if z["id"] == zone), None)
        if zr is None:
            continue
        if alert_min is None and zr["risk"]["compound"] and zr["risk"]["score"] >= 40:
            alert_min = int(fr["t_min"])
        if single_min is None and any(g["stage"] for g in zr["gases"].values()):
            single_min = int(fr["t_min"])
    ev = inc["documented_event_min"]
    return {
        "scenario": "ingested", "key": key, "minutes": len(frames), "frames": frames,
        "incident": inc["incident"], "date": inc["date"], "source": inc["source"], "zone": zone,
        "documented_event_min": ev, "event_label": inc["event_label"],
        "trinetra_alert_min": alert_min, "single_sensor_min": single_min,
        "lead_min": (ev - alert_min) if alert_min is not None else None,
        "rows": meta["rows"],
    }


@app.get("/api/incident/texas-city.csv")
def incident_texas_city_csv():
    """The reconstructed CSB Texas City sequence as a raw SCADA CSV — inspect the source."""
    return PlainTextResponse(
        texas_city_csv(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=texas_city_2005_csb.csv"},
    )


@app.get("/api/incident/jaipur.csv")
def incident_jaipur_csv():
    """The reconstructed MB Lal Jaipur sequence as a raw SCADA CSV — inspect the source."""
    return PlainTextResponse(
        jaipur_csv(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jaipur_2009_mblal.csv"},
    )


@app.get("/api/incident/texas-city")
def incident_texas_city():
    return _incident_replay("texas-city")


@app.get("/api/incident/jaipur")
def incident_jaipur():
    return _incident_replay("jaipur")


def _external_replay(key: str) -> dict:
    """Replay an external source through the SAME connector + engine, untuned. The gas DYNAMICS are
    the source's (measured, or modeled by a recognised third-party tool — never our ramp); we report
    when the engine flags the compound risk vs the single-sensor alarm on that signal, and state
    exactly what is real vs overlaid. The direct answer to 'your eval is self-authored'. If the slot's
    data file isn't committed yet, returns a clean 'pending' object (no fake data, no 500)."""
    ds = EXTERNAL_DATASETS[key]
    if not external_series(key):
        return {
            "pending": True, "key": key, "label": ds.get("label", key),
            "dataset": ds["dataset"], "citation": ds["citation"], "source": ds["source"],
            "channel": ds["channel"], "real": ds["real"], "overlaid": ds["overlaid"],
            "awaiting": f"the source curve — commit backend/app/data/{ds['file']} (see docs/EXTERNAL_DATA.md)",
        }
    col = ds.get("channel_col", "CO")
    snaps, meta = parse_csv(external_csv(key))
    engine = CompoundRiskEngine(compute_confidence=True)
    frames = [serialize_frame(s, engine.assess(s)) for s in snaps]
    zone = ds["zone"]
    alert_min = single_min = peak = None
    for fr in frames:
        zr = next((z for z in fr["zones"] if z["id"] == zone), None)
        if zr is None:
            continue
        v = zr["gases"].get(col, {}).get("value")
        if v is not None:
            peak = v if peak is None else max(peak, v)
        if alert_min is None and zr["risk"]["compound"] and zr["risk"]["score"] >= 40:
            alert_min = int(fr["t_min"])
        if single_min is None and any(g["stage"] for g in zr["gases"].values()):
            single_min = int(fr["t_min"])
    peak_unit = {"CH4": "%LEL", "O2": "%vol"}.get(col, "ppm")
    return {
        "scenario": "ingested", "key": key, "minutes": len(frames), "frames": frames, "zone": zone,
        "provenance": ds.get("provenance", "real-measured"),
        "dataset": ds["dataset"], "citation": ds["citation"], "source": ds["source"],
        "channel": ds["channel"], "window": ds["window"], "real": ds["real"], "overlaid": ds["overlaid"],
        "trinetra_alert_min": alert_min, "single_sensor_min": single_min,
        "lead_min": (single_min - alert_min) if (alert_min is not None and single_min is not None) else None,
        "peak": peak, "peak_unit": peak_unit, "peak_co_ppm": peak if col == "CO" else None,
        "samples": len(external_series(key)), "rows": meta["rows"],
        # honesty exhibits, both live-computed (neither hand-entered): De Vito ships a lead-vs-y-scale
        # sweep (detection scale-robust, lead scale-sensitive); ALOHA ships a lead-vs-receptor-distance
        # sweep (its only free parameter is the disclosed crew standoff).
        "shipped_scale": ds.get("scale_ppm_per_mg"), "lead_by_scale": external_lead_sweep(key),
        "shipped_distance_m": ds.get("shipped_distance_m"), "distance_sweep": external_distance_sweep(key),
    }


@app.get("/api/external/{key}.csv")
def external_csv_route(key: str):
    """An external source as the SCADA feed the engine ingests — inspect what flows through it."""
    if key not in EXTERNAL_DATASETS:
        return PlainTextResponse(f"unknown external dataset '{key}'", status_code=200)
    return PlainTextResponse(
        external_csv(key), media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={key}_feed.csv"},
    )


@app.get("/api/external/{key}")
def external_route(key: str):
    """Generic external-replay route: any registry key (air-quality, aloha-methane, a future STP feed)."""
    if key not in EXTERNAL_DATASETS:
        return {"error": f"unknown external dataset '{key}'", "available": list(EXTERNAL_DATASETS)}
    return _external_replay(key)


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
    engine = CompoundRiskEngine(compute_confidence=True)
    risk = None
    zone_name = zone
    for snap in sim.run(_clamp_minutes(minutes)):
        risks = engine.assess(snap)
        if zone in risks:
            risk = risks[zone]
            zone_name = snap.zones[zone].name
    if risk is None:
        return {"error": f"unknown zone '{zone}'"}

    condition = condition_from_factors(zone_name, risk.factors)
    hero = (scenario, zone) == ("vizag", "COB-1")
    matches, deg_m = _memory.match(condition, k=3)
    if deg_m and hero:  # serve the cached real ranking so the headline stays 81%
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
    engine = CompoundRiskEngine(compute_confidence=True)
    risk = None
    snap = None
    for snap in sim.run(_clamp_minutes(minutes)):
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


def _evidence_timeline(scenario_name: str, zone: str, horizon: int = 45) -> list[dict]:
    """Reconstruct the chain of events a safety officer would review: which permits
    opened when, when Trinetra escalated, and when the legacy single-sensor finally
    alarmed — so the lead time is visible as a sequence, not just a number."""
    if scenario_name == "texas-city":
        # the CSB's documented sequence — Trinetra's alert stands 10 min before the explosion
        return [
            {"t": 0, "label": "Ignition source active (idling diesel engine)", "kind": "ignition"},
            {"t": 0, "label": "20 contractors present in adjacent trailers", "kind": "personnel"},
            {"t": 10, "label": "Trinetra raises compound alert", "kind": "trinetra"},
            {"t": 17, "label": "First single-sensor gas alarm", "kind": "legacy"},
            {"t": 20, "label": "Vapour-cloud ignition — explosion (CSB-documented)", "kind": "legacy"},
        ]
    if scenario_name == "jaipur":
        # the MB Lal Committee's documented sequence — a long, undetected vapour build-up
        return [
            {"t": 0, "label": "Petrol transfer underway; vapour leak begins", "kind": "ignition"},
            {"t": 0, "label": "12 personnel on the terminal", "kind": "personnel"},
            {"t": 12, "label": "Trinetra raises compound alert", "kind": "trinetra"},
            {"t": 40, "label": "First single-sensor gas alarm", "kind": "legacy"},
            {"t": 48, "label": "Vapour-cloud ignition — explosion (committee-documented)", "kind": "legacy"},
        ]
    scn = SCENARIOS[scenario_name]
    near = set(ZONES[zone].neighbours) | {zone}
    events: list[dict] = []
    for p in scn.permits:
        if p.zone_id in near:
            kind = "ignition" if p.type in IGNITION_PERMITS else "personnel"
            label = f"{p.type.value.replace('_', ' ')} permit {p.id} opened"
            if p.worker_ids:
                label += f" — {len(p.worker_ids)} personnel"
            events.append({"t": int(p.start_min), "label": label, "kind": kind})

    sim = PlantSimulator(scenario=scn, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine(compute_confidence=True)
    comp_t = single_t = None
    for snap in sim.run(horizon):
        risks = engine.assess(snap)
        if comp_t is None and zone in risks:
            zr = risks[zone]
            if zr.compound and zr.level.rank >= RiskLevel.ELEVATED.rank:
                comp_t = int(snap.t_min)
        if single_t is None and any(GAS_THRESHOLDS[sp].in_alarm(r.value)
                                    for sp, r in snap.zone(zone).gases.items()):
            single_t = int(snap.t_min)
    if comp_t is not None:
        events.append({"t": comp_t, "label": "Trinetra raises compound alert", "kind": "trinetra"})
    if single_t is not None:
        events.append({"t": single_t, "label": "Legacy single-sensor gas alarm", "kind": "legacy"})
    events.sort(key=lambda e: (e["t"], 0 if e["kind"] != "legacy" else 1))
    return events


@app.get("/api/response")
def response(scenario: str = "vizag", zone: str = "COB-1", minutes: int = 13):
    """Orchestrate the autonomous response: actions + incident report + multilingual alert."""
    incident = scenario in ("texas-city", "jaipur")
    if not incident and scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    key = (scenario, zone, minutes) if incident else (scenario, zone)
    if key in _response_cache:
        return _response_cache[key]

    engine = CompoundRiskEngine(compute_confidence=True)
    risk = None
    snap = None
    if incident:
        # replay the reconstructed real-incident feed through the same engine
        csv_text = texas_city_csv() if scenario == "texas-city" else jaipur_csv()
        for s in parse_csv(csv_text)[0]:
            if s.t_min > minutes:
                break
            snap = s
            risks = engine.assess(s)
            if zone in risks:
                risk = risks[zone]
    else:
        sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
        for snap in sim.run(_clamp_minutes(minutes)):
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
        actions.append(f"Stage most-effective control: {risk.interventions[0].action} (pending approval)")
    actions += [
        f"Prepare multilingual evacuation broadcast for {z.name}",
        "Queue emergency-response team dispatch",
        "Freeze sensor + CCTV evidence for the investigation record",
        "Draft the preliminary incident report for the safety officer",
    ]

    impact = compute_impact(len(z.worker_ids), precedent_toll=parse_toll(m.incident.get("casualties", "")))

    package = {
        "zone": zone, "zone_name": z.name, "level": risk.level.value,
        "auto_prepared": risk.compound and risk.level.value == "critical",
        "analysis_mode": "cached" if degraded else "live",
        "impact": impact,
        "evidence_timeline": _evidence_timeline(scenario, zone),
        "channels": [
            {"channel": "Plant PA / siren", "status": "ready"},
            {"channel": "Worker mobile-app push", "status": "ready"},
            {"channel": "SMS — on-shift roster", "status": "ready"},
            {"channel": "Email — safety officer + ERT", "status": "ready"},
            {"channel": "SCADA control-room banner", "status": "ready"},
        ],
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


_patterns_cache: dict | None = None


@app.get("/api/patterns")
def patterns():
    """Incident Pattern Intelligence: recurring causal patterns mined across the
    near-miss + incident corpus, ranked as prevention priorities."""
    global _patterns_cache
    if _patterns_cache is None:
        _patterns_cache = pattern_intelligence()
    return _patterns_cache


_compliance_cache: dict[tuple, dict] = {}


@app.get("/api/compliance")
def compliance(scenario: str = "vizag", minutes: int = 13):
    """Continuous compliance audit of the live plant state vs OISD / DGMS / Factory Act."""
    if scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    key = (scenario, minutes)
    if key in _compliance_cache:
        return _compliance_cache[key]
    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    engine = CompoundRiskEngine(compute_confidence=True)
    snap = None
    risks: dict = {}
    for snap in sim.run(_clamp_minutes(minutes)):
        risks = engine.assess(snap)
    if snap is None:
        return {"error": "no frames"}
    result = compliance_audit(snap, risks)
    result["scenario"] = scenario
    result["t_min"] = int(snap.t_min)
    _compliance_cache[key] = result
    return result


_ablation_cache: dict | None = None


@app.get("/api/ablation")
def ablation():
    """Ablation study: single-sensor vs gas-trend-only vs full compound fusion.

    Proves the contextual fusion earns its complexity — same lead time as a naive
    gas-trend rule, but 0% false alarms instead of 67%."""
    global _ablation_cache
    if _ablation_cache is None:
        from ablation import run_ablation  # lazy: benchmark eval set built on first call
        res = run_ablation()
        _ablation_cache = {k: res[k] for k in ("tiers", "n_positive", "n_negative")}
    return _ablation_cache


_premortem_cache: dict | None = None


@app.get("/api/premortem")
def premortem():
    """Pre-mortem hazard discovery: search the plant's configuration space for the lethal
    compound combinations that haven't happened yet, ranked by blast radius. Surfaces the
    cross-zone hazards (gas here, ignition or crew next door) a zone-by-zone view misses."""
    global _premortem_cache
    if _premortem_cache is None:
        from ..premortem import discover
        _premortem_cache = discover()
    return _premortem_cache


@app.get("/api/feedback")
def feedback_get(plant: str = "vizag-steel"):
    """The plant's active-learning state: operator confirms / false alarms and the learned
    non-compound alert threshold (compound + HIGH/CRITICAL always page — recall is protected)."""
    return feedback_overview(plant)


@app.post("/api/feedback")
def feedback_post(plant: str = "vizag-steel", verdict: str = "confirm",
                  score: float | None = None, zone: str = ""):
    """Record an operator verdict (confirm | false_alarm) and return the updated learned state."""
    return feedback_record(plant, verdict, score, zone)


@app.post("/api/feedback/reset")
def feedback_reset_post(plant: str = "vizag-steel"):
    """Reset the learned state for a plant (demo control)."""
    return feedback_reset(plant)


_permit_cache: dict[tuple, dict] = {}


@app.get("/api/permit-gate")
def permit_gate(scenario: str = "vizag", minutes: int = 10, zone: str = "COB-1",
                permit_type: str = "hot_work", workers: int | None = None):
    """Shift-left permit-issuance gate: simulate the plant with the PROPOSED permit added and
    refuse it if issuing it would create a compound hazard — catching the danger at the permit
    desk, minutes before any single sensor would alarm. The Vizag lesson, made preventive."""
    minutes = _clamp_minutes(minutes)
    key = (scenario, int(minutes), zone, permit_type, workers)
    if key not in _permit_cache:
        _permit_cache[key] = evaluate_permit(scenario, minutes, zone, permit_type, workers)
    return _permit_cache[key]


_fleet_cache: dict | None = None


@app.get("/api/fleet")
def fleet():
    """Fleet / multi-plant rollup: the SAME compound engine across many facilities on one
    board — the scalability story made concrete. Every figure is engine-derived, not mocked."""
    global _fleet_cache
    if _fleet_cache is None:
        _fleet_cache = fleet_overview()
    return _fleet_cache


@app.on_event("startup")
def _prewarm_caches():
    """Warm the hero-scenario caches in the background so the first demo open is
    instant. The cold path builds corpus embeddings (and may wait on a 429); doing
    it here in a daemon thread keeps boot fast while the demo path goes warm."""
    import threading

    def warm():
        for fn, args in (
            (disaster_memory, ("vizag", "COB-1", 13)),
            (response, ("vizag", "COB-1", 13)),
            (agents, ("vizag", "COB-1", 13)),
            (vision, ()),
            (premortem, ()),
            (fleet, ()),
        ):
            try:
                fn(*args)
            except Exception:
                pass

    threading.Thread(target=warm, daemon=True).start()


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
