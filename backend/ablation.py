"""Ablation study — does the full compound fusion actually earn its complexity?

Runs the SAME 25-scenario evaluation set (benchmark.build_eval_set) under three
progressively richer detector tiers:

  1. Single-sensor threshold   — the incumbent: alarm when a gas crosses its setpoint.
  2. Gas-trend rule (no context) — flammable level + trend only; ignores permits,
                                   personnel and ignition (a "smarter alarm").
  3. Trinetra (full compound)  — gas + trend + ignition + personnel + blast radius.

The question it answers: would a simpler system do? Tier 2 detects the rising gas
just as early as tier 3 — but with no context it also fires on every benign gas
excursion (releases with nobody present, transient spikes), i.e. alarm fatigue.
Only the contextual fusion (tier 3) is both early AND precise.

Deterministic (seed=42) — reproducible.

    python ablation.py
"""
from __future__ import annotations

import statistics

from app.constants import GAS_THRESHOLDS
from app.domain import RiskLevel
from app.engine import CompoundRiskEngine
from app.simulator import PlantSimulator
from benchmark import build_eval_set

ALERT_LEVEL = RiskLevel.ELEVATED
TIERS = ["single", "gas_trend", "compound"]
TIER_NAMES = {
    "single": "Single-sensor threshold (incumbent)",
    "gas_trend": "Gas-trend rule (no context)",
    "compound": "Trinetra - full compound fusion",
}


def _detect_times(scenario, minutes=42) -> dict[str, int | None]:
    """First minute each tier raises its alert (hazard zone for genuine hazards;
    any zone for benign scenarios — a false alert anywhere counts)."""
    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=42)
    engine = CompoundRiskEngine()
    zone = scenario.hazard_zone or "COB-1"
    pos = scenario.expected_compound
    t: dict[str, int | None] = {k: None for k in TIERS}

    for snap in sim.run(minutes):
        risks = engine.assess(snap)
        if pos:
            zr = risks[zone]
            z = snap.zone(zone)
            single = any(GAS_THRESHOLDS[sp].in_alarm(r.value) for sp, r in z.gases.items())
            gas_trend = zr.gas_anomaly
            compound = zr.compound and zr.level.rank >= ALERT_LEVEL.rank
        else:  # strict: a false alert in ANY zone counts against the tier
            single = any(GAS_THRESHOLDS[sp].in_alarm(r.value)
                         for zz in snap.zones.values() for sp, r in zz.gases.items())
            gas_trend = any(r.gas_anomaly for r in risks.values())
            compound = any(r.compound and r.level.rank >= ALERT_LEVEL.rank for r in risks.values())
        for k, fired in (("single", single), ("gas_trend", gas_trend), ("compound", compound)):
            if t[k] is None and fired:
                t[k] = int(snap.t_min)
    return t


def run_ablation(minutes=42) -> dict:
    evalset = build_eval_set()
    agg = {k: {"tp": 0, "fp": 0, "fn": 0, "tn": 0, "leads": []} for k in TIERS}
    per_scenario = []

    for s in evalset:
        t = _detect_times(s, minutes)
        single_t = t["single"]
        row = {"id": s.name, "pos": s.expected_compound, **{k: t[k] for k in TIERS}}
        per_scenario.append(row)
        for k in TIERS:
            detected = t[k] is not None
            if s.expected_compound:
                agg[k]["tp"] += detected
                agg[k]["fn"] += not detected
                if detected and single_t is not None:
                    agg[k]["leads"].append(max(0, single_t - t[k]))
            else:
                agg[k]["fp"] += detected
                agg[k]["tn"] += not detected

    tiers = []
    for k in TIERS:
        a = agg[k]
        tp, fp, fn, tn = a["tp"], a["fp"], a["fn"], a["tn"]
        tiers.append({
            "key": k, "name": TIER_NAMES[k],
            "recall": tp / (tp + fn) if (tp + fn) else 0.0,
            "fp_rate": fp / (fp + tn) if (fp + tn) else 0.0,
            "precision": tp / (tp + fp) if (tp + fp) else 0.0,
            "mean_lead": statistics.mean(a["leads"]) if a["leads"] else 0.0,
            "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        })
    return {
        "tiers": tiers,
        "n_positive": sum(1 for s in evalset if s.expected_compound),
        "n_negative": sum(1 for s in evalset if not s.expected_compound),
        "per_scenario": per_scenario,
    }


def main():
    res = run_ablation()
    print("=" * 92)
    print("  TRINETRA ABLATION  -  is the full compound fusion necessary?  (seed=42)")
    print(f"  {res['n_positive']} genuine compound hazards + {res['n_negative']} benign decoys")
    print("=" * 92)
    print(f"  {'detector tier':<38}{'recall':>9}{'false-alarm':>13}{'precision':>11}{'lead':>8}")
    print("-" * 92)
    for tdef in res["tiers"]:
        print(f"  {tdef['name']:<38}{tdef['recall']:>8.0%}{tdef['fp_rate']:>12.0%}"
              f"{tdef['precision']:>11.0%}{tdef['mean_lead']:>6.1f}m")
    print("-" * 92)
    single, gas_trend, compound = res["tiers"]
    print("  READING:")
    print(f"    - Single-sensor gives {single['mean_lead']:.0f} min early warning and false-alarms on "
          f"{single['fp_rate']:.0%} of benign gas events.")
    print(f"    - The gas-trend rule buys back the lead ({gas_trend['mean_lead']:.1f} min) but STILL "
          f"false-alarms on {gas_trend['fp_rate']:.0%} - early, but unusable (alarm fatigue).")
    print(f"    - Full compound fusion keeps the {compound['mean_lead']:.1f} min lead AND drops false "
          f"alarms to {compound['fp_rate']:.0%}.")
    print("    >>> Context (ignition + personnel + blast radius) is what turns early")
    print("        detection into ACTIONABLE early detection. <<<")
    print("=" * 92)


if __name__ == "__main__":
    main()
