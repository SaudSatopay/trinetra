"""Operator-feedback / active-learning flywheel.

A monitoring system that cries wolf gets muted. Trinetra closes the loop: operators
confirm real alerts or flag nuisance ones, and each plant learns its OWN nuisance
profile — damping the routine gas excursions its operators repeatedly wave off, while
never touching the compound life-safety call.

The learned parameter is a single, transparent number: the score at which a
*non-compound* alert pages the operator. It starts at the default ELEVATED band (40)
and is nudged within a bounded range by feedback — up on a confirmed false alarm, back
down on a confirmed true alert.

RECALL GUARDRAIL (non-negotiable): the threshold is capped strictly below HIGH (60), and
compound + HIGH + CRITICAL alerts bypass it entirely. So feedback can only ever reduce
*non-compound nuisance* pages — it can never suppress a compound hazard or a severe
reading. The default engine is untouched, so the benchmark is byte-identical; this is a
per-plant operator-alert overlay, not a change to the detector.
"""
from __future__ import annotations

from .engine import CompoundRiskEngine
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

BASE_THRESHOLD = 40   # ELEVATED — the default non-compound operator-alert score (unchanged)
CAP_THRESHOLD = 58    # strictly below HIGH (60): HIGH / CRITICAL / compound always page
STEP = 3              # a confirmed false alarm raises the nuisance threshold
SETTLE = 1            # a confirmed true alert relaxes it back toward maximum sensitivity

_store: dict[str, dict] = {}  # plant_id -> {"confirm": int, "false_alarm": int, "log": list}


def _state(plant: str) -> dict:
    return _store.setdefault(plant, {"confirm": 0, "false_alarm": 0, "log": []})


def _threshold(s: dict) -> int:
    raw = BASE_THRESHOLD + STEP * s["false_alarm"] - SETTLE * s["confirm"]
    return max(BASE_THRESHOLD, min(CAP_THRESHOLD, raw))


_NUISANCE_CACHE: list | None = None


def _nuisance_sample() -> list[dict]:
    """Recurring non-compound gas excursions an operator at this plant actually sees —
    engine-derived from a decoy scenario (gas rising, no ignition, no crew). These are the
    nuisance pages the flywheel can damp; compound alerts are never in this set."""
    global _NUISANCE_CACHE
    if _NUISANCE_CACHE is None:
        out = []
        for mins in (12, 13, 14):
            sim = PlantSimulator(scenario=SCENARIOS["gas_no_ignition"], dt_min=1.0, seed=42)
            eng = CompoundRiskEngine()
            zr = None
            for snap in sim.run(mins + 1):
                zr = eng.assess(snap)["GCP"]
            out.append({"label": f"GCP gas excursion · T+{mins} (no ignition, no crew)",
                        "score": round(zr.score), "compound": zr.compound})
        _NUISANCE_CACHE = out
    return _NUISANCE_CACHE


def _sensitivity(thr: int) -> str:
    if thr <= BASE_THRESHOLD:
        return "Maximum (default)"
    return "Tuned" if thr < 50 else "Conservative"


def overview(plant: str) -> dict:
    s = _state(plant)
    total = s["confirm"] + s["false_alarm"]
    thr = _threshold(s)
    sample = _nuisance_sample()
    suppressed = sum(1 for n in sample if not n["compound"] and n["score"] < thr)
    return {
        "plant": plant,
        "confirm": s["confirm"], "false_alarm": s["false_alarm"], "total": total,
        "operator_precision": round(s["confirm"] / total, 2) if total else None,
        "base_threshold": BASE_THRESHOLD, "threshold": thr, "cap": CAP_THRESHOLD,
        "high_band": 60, "sensitivity": _sensitivity(thr),
        "guardrail": "Compound, HIGH and CRITICAL alerts bypass this threshold — operator "
                     "feedback can only damp non-compound nuisance pages, never reduce recall.",
        "nuisance_sample": sample,
        "suppressed_now": suppressed,
        "log": list(reversed(s["log"])),
        "note": "Each plant learns its own nuisance profile. A confirmed false alarm raises the "
                "non-compound alert threshold; a confirmed alert relaxes it. The compound "
                "life-safety call is never tuned away.",
    }


def record(plant: str, verdict: str, score: float | None = None, zone: str = "") -> dict:
    s = _state(plant)
    if verdict in ("confirm", "false_alarm"):
        s[verdict] += 1
        s["log"].append({"verdict": verdict, "score": round(score) if score is not None else None,
                         "zone": zone})
        s["log"] = s["log"][-20:]
    return overview(plant)


def reset(plant: str) -> dict:
    _store.pop(plant, None)
    return overview(plant)
