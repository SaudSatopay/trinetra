"""Held-out generalization — does the engine work beyond the scenarios it was tuned on?

The WP2 benchmark is 28 hand-authored scenarios, so a fair critique is "you tuned the
thresholds on your own test set." This harness answers it directly: it generates a large
set of RANDOMIZED scenarios — random zone, lead gas, ramp speed, peak, permit timing,
in-zone vs adjacent ignition, crew size — each run at a simulator seed the engine was
NEVER calibrated on (seed != 42), and re-scores recall / false-positive / lead time with
the same rules as the benchmark.

It is still the digital twin (not live plant telemetry — real-plant data arrives through
the /api/ingest connector, unchanged engine), but it is a held-out distribution the
thresholds never saw: a direct check for overfitting. The scenario generator is seeded,
so the held-out set is fixed and reproducible.

    python test_generalization.py
"""
from __future__ import annotations

import random
import statistics
import sys

from app.constants import GAS_THRESHOLDS, ZONES
from app.domain import Permit, PermitType, RiskLevel, Worker
from app.engine import CompoundRiskEngine
from app.scenarios import Scenario, ramp
from app.simulator import PlantSimulator

ALERT = RiskLevel.ELEVATED
GASES = ("CH4", "CO", "H2S")
PEAK_BANDS = {"CH4": (40, 72), "CO": (120, 200), "H2S": (18, 30)}
SECONDARY = {"CH4": ("CO", 110), "CO": ("CH4", 26), "H2S": ("CO", 60)}
N_POSITIVE = 120
N_NEGATIVE = 120
CONFIG_SEED = 20260623          # fixes the held-out set (reproducible)
# CI gate: generalization must stay strong, but we don't demand a suspiciously perfect
# number on a wide random distribution.
MIN_RECALL = 0.95
MAX_FPR = 0.10


def _inject(zone, gas, ramp_min, peak, confined):
    sec_gas, sec_peak = SECONDARY[gas]

    def inj(t):
        o = {(zone, gas): ramp(t, 3, peak, ramp_min),
             (zone, sec_gas): ramp(t, 3, sec_peak, ramp_min + 3)}
        if confined:
            o[(zone, "O2")] = -ramp(t, 6, 4.0, ramp_min)
        return o
    return inj


def rand_positive(rng, i):
    zone = rng.choice(list(ZONES))
    gas = rng.choice(GASES)
    ramp_min = rng.uniform(25, 55)
    peak = rng.uniform(*PEAK_BANDS[gas])
    adjacent = rng.random() < 0.4 and bool(ZONES[zone].neighbours)
    ign_zone = ZONES[zone].neighbours[0] if adjacent else zone
    crew = rng.randint(1, 4)
    hw = f"GP{i}-HW"
    cs = [f"GP{i}-CS{j}" for j in range(crew)]
    workers = [Worker(hw, "Welder", "Welder")] + [Worker(w, "Operator", "Operator") for w in cs]
    permits = [
        Permit(f"GP{i}-HWP", PermitType.HOT_WORK, ign_zone, [hw], 0, 60, "hot work"),
        Permit(f"GP{i}-CSP", PermitType.CONFINED_SPACE, zone, cs, rng.randint(0, 6), 55, "entry"),
    ]
    confined = ZONES[zone].kind == "confined_space"
    scn = Scenario(f"GP{i}", "", "", expected_compound=True, hazard_zone=zone,
                   permits=permits, workers=workers, inject=_inject(zone, gas, ramp_min, peak, confined))
    return scn, 100 + i


def rand_gas_no_ignition(rng, i):
    zone = rng.choice(list(ZONES))
    gas = rng.choice(GASES)
    confined = ZONES[zone].kind == "confined_space"
    scn = Scenario(f"GN{i}", "", "", expected_compound=False, hazard_zone=zone,
                   inject=_inject(zone, gas, rng.uniform(25, 55), rng.uniform(*PEAK_BANDS[gas]), confined))
    return scn, 200 + i


def rand_context_no_gas(rng, i):
    zone = rng.choice(list(ZONES))
    w = [f"GC{i}-W{j}" for j in range(2)]
    workers = [Worker(x, "Worker", "Welder") for x in w]
    permits = [Permit(f"GC{i}-HW", PermitType.HOT_WORK, zone, [w[0]], 0, 50, "hot work"),
               Permit(f"GC{i}-MN", PermitType.MAINTENANCE, zone, [w[1]], 0, 50, "maintenance")]
    return Scenario(f"GC{i}", "", "", expected_compound=False, hazard_zone=zone,
                    permits=permits, workers=workers), 300 + i


def rand_transient(rng, i):
    zone = rng.choice(list(ZONES))
    gas = rng.choice(GASES)
    thr = GAS_THRESHOLDS[gas]
    lo = rng.randint(7, 10)
    hi = lo + rng.randint(2, 3)

    def inj(t):
        return {(zone, gas): (thr.low_alarm * 1.6 if lo <= t <= hi else 0.0)}
    return Scenario(f"GT{i}", "", "", expected_compound=False, hazard_zone=zone, inject=inj), 400 + i


def rand_inerted_safe(rng, i):
    """All three compound factors present (rising gas + ignition + crew), but the zone is inerted
    below the limiting oxygen concentration — combustion is impossible. The held-out version of
    the benchmark's hard negative: it must NOT count as a false positive."""
    zone = rng.choice(list(ZONES))
    gas = rng.choice(GASES)
    ramp_min = rng.uniform(25, 55)
    peak = rng.uniform(*PEAK_BANDS[gas])
    crew = rng.randint(1, 4)
    cs = [f"GI{i}-CS{j}" for j in range(crew)]
    workers = [Worker(f"GI{i}-HW", "Welder", "Welder")] + [Worker(w, "Operator", "Operator") for w in cs]
    permits = [Permit(f"GI{i}-HWP", PermitType.HOT_WORK, zone, [f"GI{i}-HW"], 0, 60, "hot work"),
               Permit(f"GI{i}-CSP", PermitType.CONFINED_SPACE, zone, cs, 0, 55, "inerted entry", True)]
    sec_gas, sec_peak = SECONDARY[gas]

    def inj(t):
        return {(zone, gas): ramp(t, 3, peak, ramp_min),
                (zone, sec_gas): ramp(t, 3, sec_peak, ramp_min + 3),
                (zone, "O2"): -12.0}   # inerted below the LOC throughout
    return Scenario(f"GI{i}", "", "", expected_compound=False, hazard_zone=zone,
                    permits=permits, workers=workers, inject=inj), 500 + i


def evaluate(scenario, seed, minutes=42):
    sim = PlantSimulator(scenario=scenario, dt_min=1.0, seed=seed)
    engine = CompoundRiskEngine()
    zone = scenario.hazard_zone
    compound_t = single_t = None
    for snap in sim.run(minutes):
        risks = engine.assess(snap)
        if compound_t is None:
            if scenario.expected_compound:
                zr = risks[zone]
                hit = zr.compound and zr.level.rank >= ALERT.rank
            else:
                hit = any(r.compound and r.level.rank >= ALERT.rank for r in risks.values())
            if hit:
                compound_t = int(snap.t_min)
        if single_t is None and any(GAS_THRESHOLDS[sp].in_alarm(r.value)
                                    for sp, r in snap.zone(zone).gases.items()):
            single_t = int(snap.t_min)
    return compound_t, single_t


def main() -> bool:
    rng = random.Random(CONFIG_SEED)
    positives = [rand_positive(rng, i) for i in range(N_POSITIVE)]
    neg_makers = (rand_gas_no_ignition, rand_context_no_gas, rand_transient, rand_inerted_safe)
    negatives = [neg_makers[i % 4](rng, i) for i in range(N_NEGATIVE)]

    tp = fn = fp = tn = 0
    leads = []
    misses = []
    for scn, seed in positives:
        cmp_t, sng_t = evaluate(scn, seed)
        if cmp_t is not None:
            tp += 1
            if sng_t is not None and sng_t >= cmp_t:
                leads.append(sng_t - cmp_t)
        else:
            fn += 1
            misses.append(scn.name)
    for scn, seed in negatives:
        cmp_t, _ = evaluate(scn, seed)
        if cmp_t is not None:
            fp += 1
        else:
            tn += 1

    recall = tp / (tp + fn) if (tp + fn) else 0.0
    fpr = fp / (fp + tn) if (fp + tn) else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0

    print(f"  Held-out set : {N_POSITIVE} randomized compound hazards + {N_NEGATIVE} randomized decoys")
    print(f"                 (random zone / gas / ramp / peak / permit timing / ignition locality / crew;")
    print(f"                  a quarter of the decoys are 'inerted' hard negatives — all three factors")
    print(f"                  present but no oxidizer; simulator seeds 100+, never the seed-42 tuning set)")
    print("-" * 80)
    print(f"  Compound recall        : {recall:6.1%}   ({tp}/{tp + fn})")
    print(f"  False-positive rate    : {fpr:6.1%}   ({fp}/{fp + tn})")
    print(f"  Precision              : {precision:6.1%}")
    if leads:
        print(f"  Mean lead time         : {statistics.mean(leads):4.1f} min  "
              f"(median {statistics.median(leads):.0f}, max {max(leads)}, min {min(leads)})")
    if misses:
        print(f"  Missed (FN)            : {', '.join(misses[:8])}{' ...' if len(misses) > 8 else ''}")
    ok = recall >= MIN_RECALL and fpr <= MAX_FPR
    print("-" * 80)
    print(f"  {'PASS' if ok else 'FAIL'}: recall >= {MIN_RECALL:.0%} and FP <= {MAX_FPR:.0%} on the held-out distribution")
    return ok


if __name__ == "__main__":
    print("=" * 80)
    print("  TRINETRA GENERALIZATION  -  held-out randomized scenarios (unseen seeds)")
    print("=" * 80)
    sys.exit(0 if main() else 1)
