"""Property-based invariants for the compound-risk engine (Hypothesis).

Where the benchmark/robustness suites pin behaviour on *fixed* scenarios, these explore a
WIDE input space and assert properties that must hold for ANY reachable plant state. They
exercise the FROZEN engine — they never modify it. A failing property is a finding to
investigate, not a licence to quietly retune the engine.

Properties checked:
  1. level is monotonic in score, and matches the documented bands (pure mapping)
  2. every displayed score is bounded to [0, 100]
  3. a compound ALERT (compound AND score >= 40) is always >= ELEVATED and carries at least
     one prescriptive intervention
  4. a low / faulty O2 reading with no supplied-air permit can NEVER suppress a genuine
     explosion alert (the cont.5 safety fix, locked as a property)
  5. protected inerting is zone-local: an inerted supplied-air entry in one zone never
     suppresses a real explosion in another

FINDING (investigated, intentional — NOT a bug): the originally-proposed invariant
"compound => score >= 40" is FALSE, and that is by design. The engine's `compound` flag is a
PRE-ALERT pattern detector that latches as soon as the lethal *pattern* is present (e.g. the
cross_zone scenario flips compound=True at score 36 / level WATCH at t+8, before the magnitude
has built). Every consumer — the fleet board, the response orchestrator, the incident replays,
the OPC-UA bridge — gates the actual ALERT on `compound AND score >= 40`. So the real,
system-wide invariant is property 3 (the conjunction), which is what we pin here. Verified the
counterexample exists rather than asserting a false floor.

Deterministic per example (seed=42).  Run:  python test_invariants.py
"""
from __future__ import annotations

import sys

from hypothesis import given, settings
from hypothesis import strategies as st

from app.domain import Permit, PermitType, RiskLevel, Worker
from app.engine import CompoundRiskEngine
from app.engine.compound import LEVEL_BANDS, LOC_O2
from app.scenarios import Scenario, ramp
from app.simulator import PlantSimulator

ELEVATED_RANK = RiskLevel.ELEVATED.rank
SETTINGS = settings(max_examples=150, deadline=None)


# --- helpers ----------------------------------------------------------------
def _assess_at(scenario: Scenario, minute: int, seed: int = 42):
    """Run the engine over a scenario up to `minute` and return (last snapshot, risks)."""
    eng = CompoundRiskEngine(compute_confidence=False)
    snap = None
    risks: dict = {}
    for snap in PlantSimulator(scenario=scenario, dt_min=1.0, seed=seed).run(minute + 1):
        risks = eng.assess(snap)
    return snap, risks


def _scenario(ch4=0.0, co=0.0, ign_zone=None, occ_zone=None, n_workers=0,
              supplied_air=False, o2_drop_zone=None, o2_drop=0.0):
    """Assemble an ad-hoc hazard scenario from explicit knobs (all on the shared twin)."""
    permits: list = []
    workers: list = []
    if ign_zone:
        permits.append(Permit("PTW-IGN", PermitType.HOT_WORK, ign_zone, [], 0, 60, "ignition (prop)"))
    if n_workers > 0 and occ_zone:
        wids = [f"W{i}" for i in range(n_workers)]
        permits.append(Permit("PTW-OCC", PermitType.CONFINED_SPACE, occ_zone, wids, 0, 60,
                              "occupancy (prop)", supplied_air=supplied_air))
        workers += [Worker(w, "x", "op") for w in wids]

    def inject(t: float):
        o: dict = {}
        if ch4 > 0:
            o[("COB-1", "CH4")] = ramp(t, 3, ch4, 42)
        if co > 0:
            o[("COB-1", "CO")] = ramp(t, 3, co, 44)
        if o2_drop_zone and o2_drop > 0:
            o[(o2_drop_zone, "O2")] = -ramp(t, 2, o2_drop, 16)
        return o

    return Scenario("prop", "prop", "", True, "COB-1", permits, workers, inject)


# --- 1. level is monotonic in score + matches the bands ---------------------
@given(
    a=st.floats(min_value=-50, max_value=250, allow_nan=False, allow_infinity=False),
    b=st.floats(min_value=-50, max_value=250, allow_nan=False, allow_infinity=False),
)
def prop_level_monotonic(a, b):
    lo, hi = sorted((a, b))
    assert CompoundRiskEngine._level(hi).rank >= CompoundRiskEngine._level(lo).rank


@given(s=st.floats(min_value=0, max_value=200, allow_nan=False, allow_infinity=False))
def prop_level_matches_bands(s):
    lvl = CompoundRiskEngine._level(s)
    expected = RiskLevel.NORMAL
    for thr, band in LEVEL_BANDS:
        if s >= thr:
            expected = band
            break
    assert lvl == expected


# --- 2 + 3. score bounded; a compound ALERT is >= ELEVATED with an intervention ---
@SETTINGS
@given(
    ch4=st.floats(min_value=0, max_value=120, allow_nan=False, allow_infinity=False),
    co=st.floats(min_value=0, max_value=260, allow_nan=False, allow_infinity=False),
    ign=st.sampled_from([None, "COB-1", "GCP"]),
    n_workers=st.integers(min_value=0, max_value=4),
    occ=st.sampled_from(["COB-1", "GCP", "CST-2"]),
    minute=st.integers(min_value=5, max_value=40),
)
def prop_score_bounded_and_alert_is_actionable(ch4, co, ign, n_workers, occ, minute):
    _, risks = _assess_at(_scenario(ch4=ch4, co=co, ign_zone=ign, occ_zone=occ, n_workers=n_workers), minute)
    for r in risks.values():
        assert 0.0 <= r.score <= 100.0, f"score out of range: {r.score}"
        # the system-wide ALERT gate (see module finding) — pin the conjunction
        if r.compound and r.score >= 40.0:
            assert r.level.rank >= ELEVATED_RANK, f"alert below ELEVATED: {r.level} @ {r.score}"
            assert len(r.interventions) >= 1, "a compound alert offered no intervention"


# --- 4. a suspect O2 with no supplied-air permit never suppresses an explosion ---
@SETTINGS
@given(
    ch4=st.floats(min_value=70, max_value=120, allow_nan=False, allow_infinity=False),
    o2_drop=st.floats(min_value=0, max_value=15, allow_nan=False, allow_infinity=False),
    n_workers=st.integers(min_value=1, max_value=4),
    minute=st.integers(min_value=12, max_value=40),
)
def prop_unprotected_explosion_never_suppressed(ch4, o2_drop, n_workers, minute):
    # a genuine explosion: high rising CH4 + hot work + crew in COB-1, with NO supplied-air
    # permit. However low the O2 reading is driven, it must NOT silently kill the alert.
    scn = _scenario(ch4=ch4, ign_zone="COB-1", occ_zone="COB-1", n_workers=n_workers,
                    supplied_air=False, o2_drop_zone="COB-1", o2_drop=o2_drop)
    _, risks = _assess_at(scn, minute)
    assert risks["COB-1"].compound, (
        f"explosion alert suppressed by a suspect O2 reading (no supplied-air permit): "
        f"ch4={ch4:.0f} o2_drop={o2_drop:.1f}"
    )


# --- 5. protected inerting is zone-local -----------------------------------
@SETTINGS
@given(
    ch4=st.floats(min_value=70, max_value=120, allow_nan=False, allow_infinity=False),
    o2_drop=st.floats(min_value=11, max_value=15, allow_nan=False, allow_infinity=False),
    minute=st.integers(min_value=14, max_value=40),
)
def prop_inerting_is_zone_local(ch4, o2_drop, minute):
    # COB-1: a real, unprotected explosion. CST-2: a genuinely inerted supplied-air entry
    # (O2 driven below the LOC, crew on supplied air). The inerting must stay local to CST-2
    # and never suppress COB-1's explosion.
    permits = [
        Permit("PTW-IGN", PermitType.HOT_WORK, "COB-1", [], 0, 60, "ignition"),
        Permit("PTW-COB", PermitType.CONFINED_SPACE, "COB-1", ["A", "B"], 0, 60, "crew"),
        Permit("PTW-INERT", PermitType.CONFINED_SPACE, "CST-2", ["C"], 0, 60, "inerted", supplied_air=True),
    ]
    workers = [Worker("A", "x", "op"), Worker("B", "x", "op"), Worker("C", "x", "op")]

    def inject(t):
        return {("COB-1", "CH4"): ramp(t, 3, ch4, 42), ("CST-2", "O2"): -ramp(t, 2, o2_drop, 16)}

    scn = Scenario("prop2", "prop2", "", True, "COB-1", permits, workers, inject)
    _, risks = _assess_at(scn, minute)
    assert risks["COB-1"].compound, "an inerted entry in CST-2 wrongly suppressed COB-1's explosion"


_PROPERTIES = [
    ("level monotonic in score", prop_level_monotonic),
    ("level matches the documented bands", prop_level_matches_bands),
    ("score bounded; compound alert is >= ELEVATED with an intervention", prop_score_bounded_and_alert_is_actionable),
    ("suspect O2 (no supplied air) never suppresses an explosion", prop_unprotected_explosion_never_suppressed),
    ("protected inerting is zone-local", prop_inerting_is_zone_local),
]


def main() -> int:
    print("=" * 72)
    print("  TRINETRA ENGINE INVARIANTS  -  property-based (Hypothesis)")
    print("=" * 72)
    failed = 0
    for name, fn in _PROPERTIES:
        try:
            fn()
            print(f"  [PASS] {name}")
        except AssertionError as e:
            failed += 1
            print(f"  [FAIL] {name}\n         {str(e).splitlines()[0]}")
        except Exception as e:  # a falsifying example or generation error
            failed += 1
            print(f"  [FAIL] {name}\n         {type(e).__name__}: {str(e).splitlines()[0]}")
    print("=" * 72)
    print(f"  {len(_PROPERTIES) - failed}/{len(_PROPERTIES)} invariants hold"
          + (f"  ({failed} FAILED)" if failed else "  - all green"))
    print("=" * 72)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
