"""Robustness checks: how the compound engine behaves under sensor/permit faults.

Judges reliably ask "what about bad or missing data?". This exercises eight realistic
fault modes against the deterministic engine and asserts sensible behaviour:

  1. Stuck (frozen-high) sensor, no context      -> must NOT raise a compound alert
  2. Hazard in a different gas (CH4 quiet, CO rises) -> still caught (multi-gas redundancy)
  3. Transient noise spike, no context           -> must NOT raise a sustained alert
  4. Delayed permit sync (ignition appears late)  -> compound only once ignition is live
  5. Cross-zone exposure (crew next door)         -> compound fires on the blast radius
  6. Oxygen-deficient unprotected entry           -> asphyxiation compound fires
  7. Inerted entry WITH supplied air              -> no compound (genuinely safe)
  8. Faulty-low O2 mid-incident                   -> explosion alert NOT silently suppressed

(Missing CCTV is handled at the API layer: /api/vision degrades to an error object
and the engine never depends on CV — personnel come from the permit-to-work system.)

Deterministic (seed=42).  Run:  python test_robustness.py
"""
from __future__ import annotations

import sys

from app.domain import Permit, PermitType, RiskLevel, Worker
from app.engine import CompoundRiskEngine
from app.scenarios import CROSS_ZONE_EXPOSURE, Scenario, ramp
from app.simulator import PlantSimulator

ALERT = RiskLevel.ELEVATED


def compound_minutes(scenario: Scenario, zone: str, minutes: int = 45) -> list[int]:
    """Minutes at which `zone` shows a compound alert (ELEVATED+). Raises nothing."""
    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    hits = []
    for snap in sim.run(minutes):
        zr = engine.assess(snap)[zone]
        if zr.compound and zr.level.rank >= ALERT.rank:
            hits.append(int(snap.t_min))
    return hits


def case(name: str, ok: bool, detail: str) -> bool:
    print(f"  [{'PASS' if ok else 'FAIL'}]  {name}\n          {detail}")
    return ok


_WORKERS = [Worker("RB-W1", "A", "Fitter"), Worker("RB-W2", "B", "Welder")]


def main() -> bool:
    results = []

    # 1. Stuck (frozen-high) CH4 in an unoccupied zone: reads high but flat, no
    #    ignition, no personnel. Must not escalate to a compound life-safety alert.
    stuck = Scenario("stuck_sensor", "", "", expected_compound=False, hazard_zone="PMP",
                     inject=lambda t: {("PMP", "CH4"): 9.0})  # frozen ~0.95x alarm
    hits = compound_minutes(stuck, "PMP")
    results.append(case("Stuck-high sensor, no context -> no compound",
                        hits == [], f"compound minutes = {hits or 'none'} (expected none)"))

    # 2. The hazard develops in CO (CH4 stays quiet) with ignition + personnel.
    #    Multi-gas fusion must still catch it (no single-sensor blind spot).
    permits = [Permit("RB-HW", PermitType.HOT_WORK, "COB-1", ["RB-W2"], 0, 60, "hot work"),
               Permit("RB-CS", PermitType.CONFINED_SPACE, "COB-1", ["RB-W1"], 0, 60, "entry")]
    co_only = Scenario("co_only", "", "", expected_compound=True, hazard_zone="COB-1",
                       permits=permits, workers=_WORKERS,
                       inject=lambda t: {("COB-1", "CO"): ramp(t, 3, 170, 40)})
    hits = compound_minutes(co_only, "COB-1")
    results.append(case("Hazard in CO only (CH4 quiet) -> still caught (redundancy)",
                        len(hits) > 0, f"first compound at t={hits[0] if hits else 'NEVER'}"))

    # 3. Transient noise spike, no context. Must not raise a sustained alert.
    spike = Scenario("noise_spike_r", "", "", expected_compound=False, hazard_zone="PMP",
                     inject=lambda t: {("PMP", "CO"): (160.0 if 8 <= t <= 10 else 0.0)})
    hits = compound_minutes(spike, "PMP")
    results.append(case("Transient noise spike, no context -> no compound",
                        hits == [], f"compound minutes = {hits or 'none'} (expected none)"))

    # 4. Delayed permit sync: gas + personnel present early, but the hot-work
    #    (ignition) permit only syncs at t=12. Compound must not fire before then.
    late = [Permit("RB-HW2", PermitType.HOT_WORK, "COB-1", ["RB-W2"], 12, 48, "hot work (late sync)"),
            Permit("RB-CS2", PermitType.CONFINED_SPACE, "COB-1", ["RB-W1"], 0, 60, "entry")]
    delayed = Scenario("delayed_permit", "", "", expected_compound=True, hazard_zone="COB-1",
                       permits=late, workers=_WORKERS,
                       inject=lambda t: {("COB-1", "CH4"): ramp(t, 3, 58, 40)})
    hits = compound_minutes(delayed, "COB-1")
    ok = bool(hits) and min(hits) >= 12
    results.append(case("Delayed ignition permit (t=12) -> no compound before sync",
                        ok, f"first compound at t={hits[0] if hits else 'NEVER'} (expected >= 12)"))

    # 5. Cross-zone exposure: flammable gas + ignition in COB-1 but NOBODY inside it;
    #    the crew is next door in GCP, within the blast radius. The gate must escalate
    #    on blast-radius exposure, not just in-zone occupancy (an in-zone-only gate misses it).
    sim = PlantSimulator(scenario=CROSS_ZONE_EXPOSURE, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    fired_t = in_zone_at_fire = None
    for snap in sim.run(45):
        zr = engine.assess(snap)["COB-1"]
        if fired_t is None and zr.compound and zr.level.rank >= ALERT.rank:
            fired_t, in_zone_at_fire = int(snap.t_min), snap.zone("COB-1").worker_count
    ok = fired_t is not None and in_zone_at_fire == 0
    results.append(case("Cross-zone exposure (empty zone, crew next door) -> compound on blast radius",
                        ok, f"first compound at t={fired_t}, in-zone workers={in_zone_at_fire} (expected fired & 0 in-zone)"))

    # 6. Oxygen-deficient entry WITHOUT supplied air: no flammable, no ignition, so an explosion
    #    detector stays silent — but it is lethal. Must raise an asphyxiation compound.
    from app.scenarios import ASPHYXIATION, INERTED_SAFE
    hits = compound_minutes(ASPHYXIATION, "CST-2")
    results.append(case("Oxygen-deficient unprotected entry -> asphyxiation compound fires",
                        len(hits) > 0, f"first compound at t={hits[0] if hits else 'NEVER'} (no flammable / no ignition)"))

    # 7. The SAME inerted atmosphere but the crew is on supplied air (a real inerted entry):
    #    no oxidizer for an explosion AND no asphyxiation exposure. Must stay quiet.
    hits = compound_minutes(INERTED_SAFE, "CST-2")
    results.append(case("Inerted entry WITH supplied air -> no compound (genuinely safe)",
                        hits == [], f"compound minutes = {hits or 'none'} (expected none)"))

    # 8. A real explosion hazard (gas + ignition + crew breathing the atmosphere) where one O2
    #    sensor goes faulty-low at t=10. A lone low O2 with no inerting context must NOT suppress
    #    the alert — a silent miss is the worst failure for a safety system. Must keep firing.
    faulty = [Permit("RB-HW8", PermitType.HOT_WORK, "COB-1", ["RB-W2"], 0, 60, "hot work"),
              Permit("RB-CS8", PermitType.CONFINED_SPACE, "COB-1", ["RB-W1"], 0, 60, "entry")]
    fault = Scenario("o2_fault", "", "", expected_compound=True, hazard_zone="COB-1",
                     permits=faulty, workers=_WORKERS,
                     inject=lambda t: {("COB-1", "CH4"): ramp(t, 3, 58, 40),
                                       ("COB-1", "O2"): (-10.5 if t >= 10 else 0.0)})
    hits = compound_minutes(fault, "COB-1")
    ok = bool(hits) and any(h >= 10 for h in hits)
    results.append(case("Faulty-low O2 mid-incident -> explosion alert NOT silently suppressed",
                        ok, f"compound at t={hits[0] if hits else 'NEVER'}..{hits[-1] if hits else ''} (fires through the O2 fault)"))

    print("\n  " + ("ALL ROBUSTNESS CHECKS PASSED" if all(results) else "SOME CHECKS FAILED"))
    return all(results)


if __name__ == "__main__":
    print("=" * 80)
    print("  TRINETRA ROBUSTNESS CHECKS  -  sensor & permit fault modes  (seed=42)")
    print("=" * 80)
    sys.exit(0 if main() else 1)
