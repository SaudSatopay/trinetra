"""Trinetra WP1 demo runner — prove the digital twin works.

Streams the simulated plant minute-by-minute for a chosen scenario and shows,
for the hazard zone, the raw multi-sensor telemetry alongside the *single-sensor*
alarm baseline (the very thing the WP2 compound engine is built to beat).

Usage (from trinetra/backend):
    python run_sim.py                         # hero "vizag" scenario, 45 min
    python run_sim.py --scenario normal
    python run_sim.py --scenario gas_no_ignition --minutes 40
    python run_sim.py --list
"""
from __future__ import annotations

import argparse

from app.constants import GAS_THRESHOLDS
from app.domain import IGNITION_PERMITS, ZoneState
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator

GAS_ORDER = ["CH4", "CO", "H2S", "O2"]


def single_sensor_alarms(zone: ZoneState) -> list[str]:
    """Species currently past their own single-sensor low alarm (the baseline system)."""
    hits = []
    for sp, r in zone.gases.items():
        if GAS_THRESHOLDS[sp].in_alarm(r.value):
            hits.append(sp)
    return hits


def context_flags(zone: ZoneState) -> str:
    ignition = any(p.type in IGNITION_PERMITS for p in zone.active_permits)
    parts = []
    if ignition:
        parts.append("IGNITION")
    if zone.worker_count:
        parts.append(f"{zone.worker_count}xPERSONNEL")
    if zone.active_permits:
        parts.append("+".join(sorted(p.type.value for p in zone.active_permits)))
    return " ".join(parts) if parts else "-"


def fmt_gas(zone: ZoneState) -> str:
    cells = []
    for sp in GAS_ORDER:
        r = zone.gases[sp]
        stage = GAS_THRESHOLDS[sp].stage(r.value)
        mark = {"low": "!", "high": "!!", "danger": "!!!"}.get(stage, " ")
        cells.append(f"{sp}={r.value:>6.1f}{mark:<3}")
    return " ".join(cells)


def run(scenario_name: str, minutes: int, zone_id: str | None) -> None:
    if scenario_name not in SCENARIOS:
        raise SystemExit(f"Unknown scenario '{scenario_name}'. Options: {', '.join(SCENARIOS)}")
    scenario = SCENARIOS[scenario_name]
    target = zone_id or scenario.hazard_zone or "COB-1"

    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=42)

    print("=" * 100)
    print(f"  TRINETRA digital twin  |  {sim.plant_name}")
    print(f"  Scenario : {scenario.name}  -  {scenario.title}")
    print(f"  Truth    : compound_hazard={scenario.expected_compound}  hazard_zone={scenario.hazard_zone or '-'}")
    print(f"  Watching : {target}")
    print("=" * 100)
    print(f"{'t':>3}  {'sensors (' + target + ')':<44}  {'temp':>5}  {'single-sensor':<14}  context")
    print("-" * 100)

    first_alarm_t: float | None = None
    first_alarm_sp: str | None = None

    for snap in sim.run(minutes):
        z = snap.zone(target)
        alarms = single_sensor_alarms(z)
        if alarms and first_alarm_t is None:
            first_alarm_t, first_alarm_sp = snap.t_min, alarms[0]
        alarm_txt = ",".join(alarms) if alarms else "-- clear --"
        print(f"{int(snap.t_min):>3}  {fmt_gas(z):<44}  {z.temperature:>5.1f}  {alarm_txt:<14}  {context_flags(z)}")

    print("-" * 100)
    if first_alarm_t is None:
        print("  Single-sensor baseline: NO alarm fired in window.")
    else:
        print(f"  Single-sensor baseline: FIRST alarm at t={int(first_alarm_t)} min "
              f"({first_alarm_sp} crossed its setpoint).")
    print("  --> WP2 compound-risk engine will flag the lethal COMBINATION earlier than this,")
    print("      by fusing the rising flammable trend with the active ignition + personnel context.")
    print("=" * 100)


def main() -> None:
    ap = argparse.ArgumentParser(description="Trinetra digital-twin demo runner (WP1)")
    ap.add_argument("--scenario", default="vizag", help="scenario key (see --list)")
    ap.add_argument("--minutes", type=int, default=45, help="minutes of simulated time")
    ap.add_argument("--zone", default=None, help="zone id to watch (default: scenario hazard zone)")
    ap.add_argument("--list", action="store_true", help="list scenarios and exit")
    args = ap.parse_args()

    if args.list:
        print("Available scenarios:")
        for key, s in SCENARIOS.items():
            print(f"  {key:<16} compound={str(s.expected_compound):<5}  {s.title}")
        return

    run(args.scenario, args.minutes, args.zone)


if __name__ == "__main__":
    main()
