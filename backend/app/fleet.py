"""Fleet / multi-plant rollup.

The scalability story, made concrete: the SAME deterministic compound engine that
watches one plant runs unchanged across a fleet of facilities, each an independent
digital twin, surfaced on one pane of glass. No per-site retraining, no per-site
rules — one brain, N plants, O(zones) per plant, horizontally shardable.

Each site replays one of the standard scenarios at a chosen "now" minute so the
board shows a realistic spread of states (a critical compound hazard at one site,
a quiet permitted job at another, a single-sensor transient at a third). Every
number on the board comes from the live engine, not a mock — re-running the fleet
re-derives it. The digital-twin sites stand in for live OPC-UA / MQTT feeds; the
ingest connector (`/api/ingest`) already proves real plant data is a connector,
not a rewrite.
"""
from __future__ import annotations

from .constants import GAS_THRESHOLDS, ZONES
from .engine import CompoundRiskEngine
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

# A representative Indian heavy-industry fleet. Each entry pins a standard scenario
# to a "now" minute chosen to land the site in a distinct risk state, so the rollup
# reads like a real control room watching many plants at once.
FLEET_SITES: list[dict] = [
    {"id": "vizag", "name": "Visakhapatnam Steel — Coke Ovens", "location": "Visakhapatnam, AP",
     "type": "Integrated steel", "scenario": "vizag", "minute": 13},
    {"id": "paradip", "name": "Paradip Refinery — Coker Unit", "location": "Paradip, OD",
     "type": "Refinery", "scenario": "cross_zone", "minute": 11},
    {"id": "dahej", "name": "Dahej Petrochemicals — Gas Cleaning", "location": "Dahej, GJ",
     "type": "Petrochemicals", "scenario": "gas_no_ignition", "minute": 14},
    {"id": "bhilai", "name": "Bhilai Steel — Blast Furnace", "location": "Bhilai, CG",
     "type": "Integrated steel", "scenario": "hotwork_no_gas", "minute": 22},
    # post-transient: the CO spike (t8–11) has cleared — Trinetra never escalated it to a
    # compound alert, so the board correctly shows a nominal pump house, not a false critical.
    {"id": "haldia", "name": "Haldia — Pump House", "location": "Haldia, WB",
     "type": "Refinery", "scenario": "noise_spike", "minute": 14},
    {"id": "ennore", "name": "Ennore Terminal — Utilities", "location": "Ennore, TN",
     "type": "LNG terminal", "scenario": "normal", "minute": 12},
]

HORIZON = 45  # minutes simulated per site (to derive lead time over the full run)


def _single_sensor_alarm(snap) -> bool:
    """Would a legacy single-sensor system alarm anywhere in this plant right now?"""
    return any(GAS_THRESHOLDS[sp].in_alarm(g.value)
               for z in snap.zones.values() for sp, g in z.gases.items())


def _site_rollup(site: dict) -> dict:
    scn = SCENARIOS[site["scenario"]]
    sim = PlantSimulator(scenario=scn, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine(compute_confidence=False)  # board view: fast, no Monte-Carlo

    timeline: list[tuple] = []
    for snap in sim.run(HORIZON):
        timeline.append((snap, engine.assess(snap)))

    now_i = min(int(site["minute"]), len(timeline) - 1)
    snap, risks = timeline[now_i]

    worst_zid = max(risks, key=lambda z: risks[z].score)
    worst = risks[worst_zid]
    compound_zones = {zid for zid, r in risks.items() if r.compound and r.score >= 40}

    workers = sum(z.worker_count for z in snap.zones.values())
    # workers within the blast radius of a live compound hazard (in-zone or adjacent)
    exposed = 0
    for zid, z in snap.zones.items():
        if zid in compound_zones or any(n in compound_zones for n in ZONES[zid].neighbours):
            exposed += z.worker_count

    # lead time, plant-wide: when Trinetra first escalates vs when a single sensor first alarms
    comp_t = single_t = None
    for s, r in timeline:
        if comp_t is None and any(zr.compound and zr.score >= 40 for zr in r.values()):
            comp_t = int(s.t_min)
        if single_t is None and _single_sensor_alarm(s):
            single_t = int(s.t_min)
    lead = (single_t - comp_t) if (comp_t is not None and single_t is not None and single_t >= comp_t) else None

    return {
        "id": site["id"], "name": site["name"], "location": site["location"],
        "type": site["type"], "scenario": site["scenario"], "now_min": int(snap.t_min),
        "level": worst.level.value, "score": worst.score,
        "worst_zone": worst_zid, "worst_zone_name": worst.name,
        "compound": bool(compound_zones), "compound_zones": len(compound_zones),
        "workers": workers, "exposed": exposed,
        "trinetra_alert_min": comp_t, "single_sensor_min": single_t, "lead_min": lead,
    }


def fleet_overview() -> dict:
    """Roll the whole fleet up into one board + an aggregate the engine derives live."""
    # triage order: live compound hazards first, then by severity — what a control room wants
    sites = sorted((_site_rollup(s) for s in FLEET_SITES),
                   key=lambda s: (s["compound"], s["score"]), reverse=True)

    in_alert = sum(1 for s in sites if s["level"] in ("elevated", "high", "critical"))
    critical = sum(1 for s in sites if s["level"] == "critical")
    compound_alerts = sum(s["compound_zones"] for s in sites)
    leads = [s["lead_min"] for s in sites if s["lead_min"] is not None]

    return {
        "sites": sites,
        "fleet": {
            "sites": len(sites),
            "in_alert": in_alert,
            "critical": critical,
            "compound_alerts": compound_alerts,
            "workers_monitored": sum(s["workers"] for s in sites),
            "workers_exposed": sum(s["exposed"] for s in sites),
            "zones_monitored": len(sites) * len(ZONES),
            "max_lead_min": max(leads) if leads else None,
        },
        "scale": {
            "engine": "one shared compound engine across every site",
            "per_site": "O(zones) per assessment — independent, horizontally shardable",
            "note": "digital-twin sites stand in for live OPC-UA / MQTT feeds; ingesting real "
                    "plant data is a connector (/api/ingest), not a rewrite",
        },
    }
