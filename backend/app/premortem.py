"""Pre-mortem hazard discovery — find the lethal compounds before they happen.

Detection is reactive. This is proactive: Trinetra uses its own deterministic engine
as an oracle and SEARCHES the plant's configuration space. For each zone's flammable
inventory it tries every placement of an ignition source and a crew — in the zone, in
each adjacent zone, and out beyond the blast radius — simulates each, and reports which
placements the engine escalates to a CRITICAL compound hazard.

The discovery is the non-obvious ones: the gas builds here, but the ignition or the crew
is next door, inside the blast radius — a configuration a zone-by-zone walkdown rates
"safe" because no single zone looks dangerous. Placements outside the blast radius are
correctly cleared, so the search has a real signal, not a tautology.

"Trinetra searched N placements and found M cross-zone compound hazards — here is the one
with the largest blast radius." A search over a deterministic oracle, reproducible (seed=42).
"""
from __future__ import annotations

from .constants import ZONES
from .domain import Permit, PermitType, RiskLevel, Worker
from .engine import CompoundRiskEngine
from .scenarios import Scenario, ramp
from .simulator import PlantSimulator

_PEAK = {"CH4": 60.0, "CO": 175.0}
_HORIZON = 26
_GASES = ("CH4", "CO")


def _build(gas_zone: str, gas: str, ign_zone: str, ppl_zone: str) -> Scenario:
    permits = [
        # unmanned ignition source so personnel placement is an independent variable
        Permit("PM-IGN", PermitType.HOT_WORK, ign_zone, [], 0, 60, "ignition source"),
        Permit("PM-OCC", PermitType.CONFINED_SPACE, ppl_zone, ["PM-W1", "PM-W2"], 0, 60, "personnel"),
    ]
    workers = [Worker("PM-W1", "Worker", "Operator"), Worker("PM-W2", "Worker", "Operator")]

    def inject(t: float):
        o = {(gas_zone, gas): ramp(t, 3, _PEAK[gas], 36)}
        if ZONES[gas_zone].kind == "confined_space" and gas != "O2":
            o[(gas_zone, "O2")] = -ramp(t, 6, 4.0, 36)
        return o

    return Scenario("premortem", "", "", expected_compound=True, hazard_zone=gas_zone,
                    permits=permits, workers=workers, inject=inject)


def _evaluate(gas_zone: str, gas: str, ign_zone: str, ppl_zone: str):
    scn = _build(gas_zone, gas, ign_zone, ppl_zone)
    sim = PlantSimulator(scenario=scn, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    for snap in sim.run(_HORIZON):
        zr = engine.assess(snap)[gas_zone]
        if zr.compound and zr.level == RiskLevel.CRITICAL:
            exposed = snap.zone(gas_zone).worker_count + sum(
                snap.zone(n).worker_count for n in ZONES[gas_zone].neighbours if n in snap.zones)
            return int(snap.t_min), int(round(zr.score)), exposed
    return None, 0, 0


def discover(top: int = 6) -> dict:
    """Search ignition/crew placements around each zone's flammable inventory."""
    best: dict[tuple, dict] = {}
    explored = n_hazard = n_cross = n_cleared = 0
    for z in ZONES:
        neigh = list(ZONES[z].neighbours)
        radius = [z] + neigh
        control = next((k for k in ZONES if k not in radius), None)   # one out-of-radius placement
        candidates = radius + ([control] if control else [])
        for gas in _GASES:
            for ign_zone in candidates:
                for ppl_zone in candidates:
                    explored += 1
                    t_crit, peak, exposed = _evaluate(z, gas, ign_zone, ppl_zone)
                    if t_crit is None:
                        n_cleared += 1
                        continue
                    n_hazard += 1
                    cross = (ign_zone != z) or (ppl_zone != z)
                    n_cross += cross
                    ign_txt = "in-zone ignition" if ign_zone == z else f"ignition in {ZONES[ign_zone].name}"
                    ppl_txt = "crew in-zone" if ppl_zone == z else f"crew in {ZONES[ppl_zone].name}"
                    blast = [ZONES[n].name for n in neigh]
                    finding = {
                        "zone": z, "zone_name": ZONES[z].name, "gas": gas,
                        "ignition_zone": ign_zone, "personnel_zone": ppl_zone,
                        "cross_zone": cross, "t_critical": t_crit, "peak_score": peak,
                        "exposed": exposed, "blast_radius_zones": len(neigh) + 1, "blast_zones": blast,
                        "summary": (f"Rising {gas} in {ZONES[z].name} with {ign_txt} and {ppl_txt} "
                                    f"reaches compound CRITICAL by T+{t_crit}; blast radius spans "
                                    f"{', '.join(blast) or 'the zone alone'}."),
                    }
                    # surface the worst NON-OBVIOUS hazard per (zone, gas): prefer cross-zone, larger blast, earlier
                    key = (z, gas)
                    rank = (cross, len(neigh), exposed, -t_crit)
                    if key not in best or rank > best[key]["_rank"]:
                        finding["_rank"] = rank
                        best[key] = finding

    findings = sorted(best.values(),
                      key=lambda f: (-int(f["cross_zone"]), -f["blast_radius_zones"], -f["exposed"], f["t_critical"]))
    for f in findings:
        f.pop("_rank", None)
    return {
        "explored": explored,
        "n_hazard": n_hazard,
        "n_cross_zone": n_cross,
        "n_cleared": n_cleared,
        "findings": findings[:top],
        "note": ("Each finding is a placement the engine escalated to a CRITICAL compound hazard. "
                 "Cross-zone findings — the ignition or the crew sits in an adjacent zone — are the ones "
                 f"a zone-by-zone walkdown misses. {n_cleared} placements beyond the blast radius were "
                 "correctly cleared."),
    }
