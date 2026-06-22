"""WP2 demo runner — Trinetra compound engine vs the single-sensor baseline.

Streams a scenario and, for the hazard zone, shows the compound-risk score/level
and the first actionable compound alert — next to the moment the legacy
single-sensor system would first alarm. The gap is the lead time that saves lives.

    python run_engine.py                       # hero "vizag"
    python run_engine.py --scenario gas_no_ignition
    python run_engine.py --scenario hotwork_no_gas
"""
from __future__ import annotations

import argparse

from app.constants import GAS_THRESHOLDS
from app.domain import RiskLevel
from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator

ALERT_LEVEL = RiskLevel.ELEVATED   # an actionable compound alert is ELEVATED+ with the compound flag


def first_single_sensor_alarm(zone) -> bool:
    return any(GAS_THRESHOLDS[sp].in_alarm(r.value) for sp, r in zone.gases.items())


def run(scenario_name: str, minutes: int, zone_id: str | None) -> None:
    if scenario_name not in SCENARIOS:
        raise SystemExit(f"Unknown scenario '{scenario_name}'. Options: {', '.join(SCENARIOS)}")
    scenario = SCENARIOS[scenario_name]
    target = zone_id or scenario.hazard_zone or "COB-1"
    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()

    print("=" * 104)
    print(f"  TRINETRA compound engine  vs  single-sensor baseline")
    print(f"  Scenario : {scenario.name}  -  {scenario.title}   (truth: compound={scenario.expected_compound})")
    print(f"  Watching : {target}")
    print("=" * 104)
    print(f"{'t':>3}  {'score':>5}  {'level':<9}  {'cmpd':<4}  {'t->thr':>7}  {'single-sensor':<14}  top intervention")
    print("-" * 104)

    trinetra_t = None
    baseline_t = None
    for snap in sim.run(minutes):
        risks = engine.assess(snap)
        zr = risks[target]
        z = snap.zone(target)

        ss = first_single_sensor_alarm(z)
        if ss and baseline_t is None:
            baseline_t = int(snap.t_min)
        actionable = zr.compound and zr.level.rank >= ALERT_LEVEL.rank
        if actionable and trinetra_t is None:
            trinetra_t = int(snap.t_min)

        ttt = f"{zr.time_to_threshold_min:>5.0f}m" if zr.time_to_threshold_min else "    -"
        top = zr.interventions[0] if zr.interventions else None
        top_txt = f"{top.action} (-{top.delta:.0f})" if top else "-"
        flag = "YES" if zr.compound else "-"
        ss_txt = "ALARM" if ss else "clear"
        print(f"{int(snap.t_min):>3}  {zr.score:>5.0f}  {zr.level.value:<9}  {flag:<4}  {ttt:>7}  {ss_txt:<14}  {top_txt}")

    print("-" * 104)
    print(f"  Trinetra first compound alert : t = {trinetra_t if trinetra_t is not None else '--'} min")
    print(f"  Single-sensor first alarm     : t = {baseline_t if baseline_t is not None else '--'} min")
    if trinetra_t is not None and baseline_t is not None:
        print(f"  >>> LEAD TIME = {baseline_t - trinetra_t} min earlier than the legacy system <<<")
    elif scenario.expected_compound is False and trinetra_t is None:
        print(f"  >>> Correctly raised NO compound alert (truth: not a compound hazard) <<<")
    print("=" * 104)


def main() -> None:
    ap = argparse.ArgumentParser(description="Trinetra compound engine demo (WP2)")
    ap.add_argument("--scenario", default="vizag")
    ap.add_argument("--minutes", type=int, default=45)
    ap.add_argument("--zone", default=None)
    args = ap.parse_args()
    run(args.scenario, args.minutes, args.zone)


if __name__ == "__main__":
    main()
