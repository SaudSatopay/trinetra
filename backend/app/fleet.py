"""Fleet / multi-plant rollup + measured scale economics.

The scalability story, made concrete and MEASURED. The same deterministic compound
engine that watches one plant runs unchanged across a fleet of facilities, each an
independent digital twin, surfaced on one pane of glass — no per-site retraining, no
per-site rules, one brain, N plants, O(zones) per plant, horizontally shardable.

Two things live here:
  * ``fleet_overview(n)`` — the control-room board: N engine-derived plants (six named
    flagship sites plus a procedurally-generated long tail), each replaying a standard
    scenario at a chosen "now" minute so the board shows a realistic spread of states
    (a live compound hazard at one site, a permitted job at another, a cleared transient
    at a third). Every number comes from the live engine, not a mock — re-running it
    re-derives the board. Each plant uses its own seed, so two sites on the same scenario
    are distinct sensor realizations.
  * ``measure_scale(n)`` — the unit economics, MEASURED not asserted: time the engine's
    per-plant assessment over a representative snapshot pool (p50/p99 + sustained rate),
    then derive plants-per-core at 1 Hz and a $/plant/month cost curve. Each plant is an
    independent, stateless shard (no shared state, no per-site model), so the fleet scales
    horizontally by adding plain workers.

The digital-twin sites stand in for live OPC-UA / MQTT feeds; the OPC-UA bridge
(``/api/opcua/session``) and the CSV connector (``/api/ingest``) already prove that
ingesting real plant data is a connector, not a rewrite.
"""
from __future__ import annotations

import math
import random
import time

from .constants import GAS_THRESHOLDS, ZONES
from .engine import CompoundRiskEngine
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

# --- Six named flagship sites (curated; real Indian heavy industry) -----------
# Each pins a standard scenario to a "now" minute chosen to land the site in a
# distinct risk state, so the rollup reads like a real control room.
_FLAGSHIP_SITES: list[dict] = [
    {"id": "vizag", "name": "Visakhapatnam Steel — Coke Ovens", "location": "Visakhapatnam, AP",
     "type": "Integrated steel", "scenario": "vizag", "minute": 13},
    {"id": "paradip", "name": "Paradip Refinery — Coker Unit", "location": "Paradip, OD",
     "type": "Refinery", "scenario": "cross_zone", "minute": 11},
    {"id": "dahej", "name": "Dahej Petrochemicals — Gas Cleaning", "location": "Dahej, GJ",
     "type": "Petrochemicals", "scenario": "gas_no_ignition", "minute": 14},
    {"id": "bhilai", "name": "Bhilai Steel — Blast Furnace", "location": "Bhilai, CG",
     "type": "Integrated steel", "scenario": "hotwork_no_gas", "minute": 22},
    # post-transient: the CO spike (t8-11) has cleared — Trinetra never escalated it to a
    # compound alert, so the board correctly shows a nominal pump house, not a false critical.
    {"id": "haldia", "name": "Haldia — Pump House", "location": "Haldia, WB",
     "type": "Refinery", "scenario": "noise_spike", "minute": 14},
    {"id": "ennore", "name": "Ennore Terminal — Utilities", "location": "Ennore, TN",
     "type": "LNG terminal", "scenario": "normal", "minute": 12},
]

# --- The generated long tail (so the board is a real fleet, not six tiles) -----
# Heavy-industry sites broadly share the same hazard classes (flammable gas, hot work,
# confined space, oxygen deficiency), so any scenario is plausible at any site; the type
# label is cosmetic, the physics is the shared twin, every figure is engine-derived.
_CITIES: list[tuple[str, str]] = [
    ("Jamnagar", "GJ"), ("Vadodara", "GJ"), ("Hazira", "GJ"), ("Mundra", "GJ"),
    ("Rourkela", "OD"), ("Angul", "OD"), ("Dhamra", "OD"), ("Gopalpur", "OD"),
    ("Kakinada", "AP"), ("Visakhapatnam", "AP"), ("Manali", "TN"), ("Cuddalore", "TN"),
    ("Salem", "TN"), ("Mangaluru", "KA"), ("Kochi", "KL"), ("Bathinda", "PB"),
    ("Panipat", "HR"), ("Mathura", "UP"), ("Bina", "MP"), ("Durgapur", "WB"),
    ("Bokaro", "JH"), ("Jamshedpur", "JH"), ("Sindri", "JH"), ("Nagothane", "MH"),
    ("Trombay", "MH"), ("Ramagundam", "TS"), ("Numaligarh", "AS"), ("Barauni", "BR"),
    ("Koyali", "GJ"), ("Bongaigaon", "AS"), ("Paradip", "OD"), ("Haldia", "WB"),
]
_TYPES: list[tuple[str, list[str]]] = [
    ("Integrated steel", ["Coke Ovens", "Blast Furnace", "Gas Cleaning", "Sinter Plant"]),
    ("Refinery", ["Coker Unit", "Crude Distillation", "FCC Unit", "Hydrocracker"]),
    ("Petrochemicals", ["Cracker Unit", "Aromatics Complex", "Olefins Unit"]),
    ("LNG terminal", ["Regas Train", "Storage & Loading"]),
    ("Fertilizer", ["Ammonia Unit", "Urea Plant"]),
    ("Power", ["Boiler House", "Coal Handling"]),
]
# The fleet mix: most plants nominal, a realistic minority in alert, a handful in a
# genuine compound hazard right now — the spread a fleet safety desk actually triages.
_SCENARIO_MIX: list[tuple[str, int]] = [
    ("normal", 50), ("hotwork_no_gas", 14), ("gas_no_ignition", 12), ("noise_spike", 8),
    ("vizag", 6), ("cross_zone", 5), ("asphyxiation", 4), ("inerted", 1),
]
# "now" window per scenario, so the pinned minute lands the site in a representative state.
_MINUTE_WINDOW: dict[str, tuple[int, int]] = {
    "normal": (8, 22), "hotwork_no_gas": (14, 26), "gas_no_ignition": (10, 16),
    "noise_spike": (14, 22), "vizag": (12, 17), "cross_zone": (12, 17),
    "asphyxiation": (12, 17), "inerted": (11, 16),
}

FLEET_SIZE = 100
HORIZON = 45             # minutes simulated per site (to derive lead time over the full run)
TAGS_PER_ZONE = 6        # 4 gas species + temperature + pressure (matches throughput.py)
CORE_COST_USD_MO = 30.0  # a small dedicated cloud vCPU (~$0.04/core-hr x 730 h); stated, conservative
PROVISION_HEADROOM = 4.0  # budget the risk engine at 1/4 of a core, leaving room for the co-located
                          # per-request CPU on the same core (frame (de)serialization, GC, burst smoothing)
# sizes carried out past the single-core ceiling so the table SHOWS the linear,
# coordination-free horizontal scaling (cores cross over), not just a flat line.
COST_FLEET_SIZES = [10, 50, 100, 500, 1000, 5000, 10000]


def _generated_sites(n: int) -> list[dict]:
    """The flagship six, then a deterministic procedural tail out to n plants.

    Everything is derived from the plant index, so the fleet is fully reproducible
    (the project's credibility discipline): same n -> same board."""
    sites = list(_FLAGSHIP_SITES)
    pop = [s for s, _ in _SCENARIO_MIX]
    wts = [w for _, w in _SCENARIO_MIX]
    for i in range(len(sites), n):
        rng = random.Random(1000 + i)  # deterministic per-plant cosmetic choices
        scn = rng.choices(pop, weights=wts, k=1)[0]
        city, state = rng.choice(_CITIES)
        type_name, units = rng.choice(_TYPES)
        unit = rng.choice(units)
        lo, hi = _MINUTE_WINDOW[scn]
        sites.append({
            "id": f"gen-{i:03d}", "name": f"{city} — {unit}", "location": f"{city}, {state}",
            "type": type_name, "scenario": scn, "minute": rng.randint(lo, hi),
            "seed": 42 + i,  # a distinct, reproducible sensor realization per plant
        })
    return sites


def _single_sensor_alarm(snap) -> bool:
    """Would a legacy single-sensor system alarm anywhere in this plant right now?"""
    return any(GAS_THRESHOLDS[sp].in_alarm(g.value)
               for z in snap.zones.values() for sp, g in z.gases.items())


def _site_rollup(site: dict) -> dict:
    scn = SCENARIOS[site["scenario"]]
    sim = PlantSimulator(scenario=scn, dt_min=1.0, seed=int(site.get("seed", 42)))
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


def fleet_overview(n: int = FLEET_SIZE) -> dict:
    """Roll the whole fleet up into one board + an aggregate the engine derives live."""
    n = max(len(_FLAGSHIP_SITES), int(n))
    # triage order: live compound hazards first, then by severity — what a control room wants
    sites = sorted((_site_rollup(s) for s in _generated_sites(n)),
                   key=lambda s: (s["compound"], s["score"]), reverse=True)

    in_alert = sum(1 for s in sites if s["level"] in ("elevated", "high", "critical"))
    critical = sum(1 for s in sites if s["level"] == "critical")
    compound_sites = sum(1 for s in sites if s["compound"])
    compound_alerts = sum(s["compound_zones"] for s in sites)
    leads = [s["lead_min"] for s in sites if s["lead_min"] is not None]

    return {
        "sites": sites,
        "fleet": {
            "sites": len(sites),
            "in_alert": in_alert,
            "critical": critical,
            "compound_sites": compound_sites,
            "compound_alerts": compound_alerts,
            "workers_monitored": sum(s["workers"] for s in sites),
            "workers_exposed": sum(s["exposed"] for s in sites),
            "zones_monitored": len(sites) * len(ZONES),
            "sensors_monitored": len(sites) * len(ZONES) * TAGS_PER_ZONE,
            "max_lead_min": max(leads) if leads else None,
        },
        "scale": {
            "engine": "one shared compound engine across every site",
            "per_site": "O(zones) per assessment — independent, horizontally shardable",
            "note": "digital-twin sites stand in for live OPC-UA / MQTT feeds; ingesting real "
                    "plant data is a connector (/api/ingest, /api/opcua/session), not a rewrite",
        },
    }


# ---------------------------------------------------------------------------
# Measured scale economics — plants-per-core + $/plant/month, timed not asserted
# ---------------------------------------------------------------------------

def _snapshot_pool() -> list:
    """A representative spread of plant snapshots — every scenario, a range of minutes —
    to time the engine over realistic input (not just the quiet baseline)."""
    pool: list = []
    for name in SCENARIOS:
        sim = PlantSimulator(scenario=SCENARIOS[name], dt_min=1.0, seed=42)
        pool.extend(sim.collect(28))
    return pool


def _percentile(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    return sorted_vals[min(len(sorted_vals) - 1, int(len(sorted_vals) * q))]


def measure_scale(n: int = FLEET_SIZE) -> dict:
    """Measure, don't assert: time one engine instance assessing a whole plant (all zones)
    over a representative snapshot pool, then derive plants-per-core at 1 Hz and a $/plant
    cost curve. A plant-assessment == one ``engine.assess(snapshot)`` (all zones at once)."""
    n = max(len(_FLAGSHIP_SITES), int(n))
    pool = _snapshot_pool()
    L = len(pool)
    engine = CompoundRiskEngine(compute_confidence=False)  # the hot path: no display-only Monte-Carlo

    # warm the engine's per-zone trend history so timings reflect steady state
    for snap in pool:
        engine.assess(snap)

    # (a) per-call latency for percentiles
    lat: list[float] = []
    for i in range(4000):
        s0 = time.perf_counter()
        engine.assess(pool[i % L])
        lat.append((time.perf_counter() - s0) * 1000.0)
    lat.sort()
    p50 = _percentile(lat, 0.50)
    p99 = _percentile(lat, 0.99)
    mean_ms = sum(lat) / len(lat)

    # (b) a clean, untimed loop for the sustained rate (no per-call timer overhead)
    iters = 20000
    t0 = time.perf_counter()
    for i in range(iters):
        engine.assess(pool[i % L])
    wall = time.perf_counter() - t0
    sustained = iters / wall  # plant-assessments / sec on one core

    # at 1 Hz per plant, one core serves `sustained` plants; provision with headroom for the
    # co-located per-request CPU on the same core ((de)serialization, GC pauses, burst smoothing).
    plants_per_core = max(1, int(sustained / PROVISION_HEADROOM))

    def _row(size: int) -> dict:
        cores = max(1, math.ceil(size / plants_per_core))
        total = cores * CORE_COST_USD_MO
        return {"plants": size, "cores": cores, "total_usd_mo": round(total, 2),
                "per_plant_usd_mo": round(total / size, 3)}

    cost_curve = [_row(s) for s in COST_FLEET_SIZES]
    cores_for_fleet = max(1, math.ceil(n / plants_per_core))

    return {
        "n_plants": n,
        "zones_per_plant": len(ZONES),
        "tags_per_zone": TAGS_PER_ZONE,
        "total_sensors": n * len(ZONES) * TAGS_PER_ZONE,
        "measured": {
            "p50_ms": round(p50, 4),
            "p99_ms": round(p99, 4),
            "mean_ms": round(mean_ms, 4),
            "assessments_per_sec": round(sustained),
            "iters": iters,
            "pool_size": L,
        },
        "provisioning": {
            "core_cost_usd_mo": CORE_COST_USD_MO,
            "headroom_x": PROVISION_HEADROOM,
            "plants_per_core_1hz": plants_per_core,
            "cores_for_fleet": cores_for_fleet,
            "fleet_cost_usd_mo": round(cores_for_fleet * CORE_COST_USD_MO, 2),
            "fleet_per_plant_usd_mo": round(cores_for_fleet * CORE_COST_USD_MO / n, 3),
        },
        "cost_curve": cost_curve,
        "shard": "each plant is an independent, stateless shard — no shared state, no per-site "
                 "model; the engine is O(zones) per assessment, so the fleet scales horizontally "
                 "by adding plain workers (linear, no coordination).",
        "basis": "measured single-core CompoundRiskEngine.assess() over a representative snapshot "
                 "pool (every scenario, warmed trend history), confidence Monte-Carlo off (it is "
                 "display-only) — so plants/core is hardware-dependent; re-measured live here. Core = "
                 "a small dedicated cloud vCPU at ~$30/core-month, provisioned at 1/"
                 + str(int(PROVISION_HEADROOM)) + "x of measured capacity to leave room for the "
                 "co-located per-request CPU on the same core ((de)serialization, GC, bursts). "
                 "Risk-compute only — the separate ingest, storage and networking infrastructure "
                 "scales roughly linearly and is not in this figure.",
    }
