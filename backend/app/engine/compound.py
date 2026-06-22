"""Trinetra compound-risk engine (WP2).

The core IP. A *hybrid* engine: a transparent, deterministic scoring backbone
makes the safety call (no LLM hallucination in the life-safety loop), expressed
so the **combination** of factors is worse than any single one.

Differentiators vs a generic threshold dashboard:
  * compound fusion — abnormal flammable level × rising trend × ignition × personnel
    (the context acts as a *multiplier*, so a sub-alarm gas under hot work with
    people present scores far higher than the same gas alone);
  * baseline-subtracted — normal background gas is ignored, so we don't manufacture
    risk from a coke oven simply being a coke oven;
  * predictive time-to-threshold — extrapolate the trend, don't wait for the alarm;
  * prescriptive interventions — counterfactual "which single action cuts risk most",
    computed on the uncapped score so it stays meaningful even at saturation;
  * cross-zone blast-radius reasoning — ignition in an ADJACENT zone still counts.

Deterministic given the simulator seed → the WP2 benchmark numbers are reproducible.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Optional

from ..constants import FLAMMABLE_GASES, GAS_THRESHOLDS, ZONES
from ..domain import IGNITION_PERMITS, PermitType, PlantSnapshot, RiskLevel

# --- tuning constants (explicit & testable) ---------------------------------
WINDOW = 5                       # minutes of history used for trend/slope
W_LEVEL, W_SLOPE = 0.60, 0.50    # weight on abnormal level vs projected rise
LOOKAHEAD = 5.0                  # minutes projected forward from the current slope
W_TOXIC, W_O2 = 0.30, 0.40
FLOOR_FLAM, FLOOR_TOXIC = 0.30, 0.30   # below this fraction-of-alarm = background, ignored
M_IGNITION_SAME, M_IGNITION_ADJ = 0.80, 0.40   # ignition in-zone vs adjacent (blast radius)
M_PERSONNEL, M_CONFINED = 0.50, 0.60
LEVEL_BANDS = [(80, RiskLevel.CRITICAL), (60, RiskLevel.HIGH),
               (40, RiskLevel.ELEVATED), (20, RiskLevel.WATCH)]
COMPOUND_PRESENT_FRAC = 0.50     # flammable level (fraction of alarm) — sits above ALL zone baselines
COMPOUND_HIGH_FRAC = 0.70        # a high flammable level alone qualifies as evidence
COMPOUND_SLOPE = 0.012           # normalized rise/min that counts as "trending up" (noise-robust)
INTERVENTION_MIN_SCORE = 40      # only surface interventions once it's actionable
O2_AMBIENT = 20.9


@dataclass
class Intervention:
    action: str
    resulting_level: RiskLevel
    delta: float            # score reduction this single action would achieve


@dataclass
class _Features:
    flam_level: float       # max flammable reading as a fraction of its low alarm
    flam_slope: float       # normalized rise/min of the fastest-rising flammable
    toxic_level: float      # max(CO, H2S) as a fraction of low alarm
    o2_deficit: float       # 0..1 toward the 16% danger floor
    ignition_same: bool
    ignition_adj: bool
    personnel: int
    confined: bool
    fastest_gas: Optional[str]
    fastest_slope_raw: float  # in the gas's own unit per minute


@dataclass
class ZoneRisk:
    zone_id: str
    name: str
    score: float                         # 0..100 (capped, for display)
    level: RiskLevel
    compound: bool                       # the specific lethal pattern is present
    gas_anomaly: bool                    # context-blind signal: anomalous flammable gas (level/trend) alone
    factors: list                        # human-readable contributing factors
    time_to_threshold_min: Optional[float]
    interventions: list                  # ranked list[Intervention]
    ignition_ref: str                    # permit id / "adjacent" / ""
    personnel: int


class CompoundRiskEngine:
    def __init__(self, window: int = WINDOW):
        self.window = window
        self._hist: dict[str, deque] = {zid: deque(maxlen=window) for zid in ZONES}

    def assess(self, snap: PlantSnapshot) -> dict[str, ZoneRisk]:
        for zid, z in snap.zones.items():
            self._hist[zid].append((snap.t_min, {sp: r.value for sp, r in z.gases.items()}))
        return {zid: self._assess_zone(zid, snap) for zid in snap.zones}

    # -- trend ---------------------------------------------------------------
    def _slope(self, zid: str, sp: str) -> float:
        h = self._hist[zid]
        if len(h) < 2:
            return 0.0
        (t0, g0), (t1, g1) = h[0], h[-1]
        return 0.0 if t1 == t0 else (g1[sp] - g0[sp]) / (t1 - t0)

    # -- feature extraction --------------------------------------------------
    def _features(self, zid: str, snap: PlantSnapshot) -> _Features:
        z = snap.zones[zid]
        flam_level = 0.0
        flam_slope = 0.0
        fastest = None
        fastest_raw = 0.0
        for sp in FLAMMABLE_GASES:
            thr = GAS_THRESHOLDS[sp]
            flam_level = max(flam_level, z.gases[sp].value / thr.low_alarm)
            sl_norm = self._slope(zid, sp) / thr.low_alarm
            if sl_norm > flam_slope:
                flam_slope, fastest, fastest_raw = sl_norm, sp, self._slope(zid, sp)

        toxic_level = max(z.gases["CO"].value / GAS_THRESHOLDS["CO"].low_alarm,
                          z.gases["H2S"].value / GAS_THRESHOLDS["H2S"].low_alarm)
        o2_deficit = max(0.0, (O2_AMBIENT - z.gases["O2"].value) / (O2_AMBIENT - 16.0))

        ignition_same = any(p.type in IGNITION_PERMITS for p in z.active_permits)
        ignition_adj = any(
            any(p.type in IGNITION_PERMITS for p in snap.zones[n].active_permits)
            for n in ZONES[zid].neighbours if n in snap.zones
        )
        confined = (ZONES[zid].kind == "confined_space"
                    or any(p.type == PermitType.CONFINED_SPACE for p in z.active_permits))
        return _Features(flam_level, flam_slope, toxic_level, o2_deficit,
                         ignition_same, ignition_adj, z.worker_count, confined,
                         fastest, fastest_raw)

    # -- scoring (uncapped; with counterfactual switches) --------------------
    def _score(self, f: _Features, *, drop_ignition=False, drop_personnel=False,
               ventilate=False) -> float:
        flam_level = f.flam_level * (0.4 if ventilate else 1.0)
        flam_slope = f.flam_slope * (0.2 if ventilate else 1.0)
        a_flam = max(0.0, flam_level - FLOOR_FLAM)      # abnormal flammable level (background removed)
        m_flam = max(0.0, flam_slope * LOOKAHEAD)       # projected rise over the lookahead
        a_tox = max(0.0, f.toxic_level - FLOOR_TOXIC)
        raw = W_LEVEL * a_flam + W_SLOPE * m_flam + W_TOXIC * a_tox + W_O2 * f.o2_deficit
        ign = 0.0 if drop_ignition else (M_IGNITION_SAME * f.ignition_same
                                         + M_IGNITION_ADJ * f.ignition_adj)
        per = 0.0 if drop_personnel else (M_PERSONNEL if f.personnel > 0 else 0.0)
        conf = M_CONFINED * f.o2_deficit if f.confined else 0.0
        return 100.0 * raw * (1.0 + ign + per + conf)   # uncapped on purpose

    @staticmethod
    def _level(score: float) -> RiskLevel:
        for thr, lvl in LEVEL_BANDS:
            if score >= thr:
                return lvl
        return RiskLevel.NORMAL

    # -- per-zone assessment -------------------------------------------------
    def _assess_zone(self, zid: str, snap: PlantSnapshot) -> ZoneRisk:
        z = snap.zones[zid]
        f = self._features(zid, snap)
        raw = self._score(f)
        score = min(100.0, raw)
        level = self._level(score)

        flammable_evidence = ((f.flam_level >= COMPOUND_PRESENT_FRAC and f.flam_slope > COMPOUND_SLOPE)
                              or f.flam_level >= COMPOUND_HIGH_FRAC)
        ignition = f.ignition_same or f.ignition_adj
        compound = bool(flammable_evidence and ignition and f.personnel > 0)

        factors: list[str] = []
        if f.flam_slope > COMPOUND_SLOPE and f.fastest_gas and f.flam_level >= COMPOUND_PRESENT_FRAC:
            factors.append(f"{f.fastest_gas} rising {f.fastest_slope_raw:+.1f}/min while still only "
                           f"{int(f.flam_level * 100)}% of alarm (sub-threshold)")
        elif f.flam_level >= COMPOUND_HIGH_FRAC:
            factors.append(f"flammable gas at {int(f.flam_level * 100)}% of alarm")
        if f.ignition_same:
            factors.append("active ignition source (hot-work) in zone")
        elif f.ignition_adj:
            factors.append("ignition source in adjacent zone (within blast radius)")
        if f.personnel > 0:
            factors.append(f"{f.personnel} personnel present")
        if f.confined and f.o2_deficit > 0.1:
            factors.append(f"confined space, O2 down to {z.gases['O2'].value:.1f}%")
        if f.toxic_level >= 1.0:
            factors.append("toxic gas above exposure limit")

        ttt = None
        if f.fastest_gas and f.fastest_slope_raw > 0.01:
            thr = GAS_THRESHOLDS[f.fastest_gas]
            current = z.gases[f.fastest_gas].value
            if current < thr.danger:
                ttt = round((thr.danger - current) / f.fastest_slope_raw, 1)

        interventions: list[Intervention] = []
        if score >= INTERVENTION_MIN_SCORE and raw > 0:
            base = raw

            def reduction(s: float) -> float:
                # percentage of the (uncapped) risk this single action removes — stays
                # meaningful even when the displayed score is saturated at 100.
                return round(max(0.0, min(100.0, (base - s) / base * 100.0)))

            cands: list[Intervention] = []
            if ignition:
                s = self._score(f, drop_ignition=True)
                pid = next((p.id for p in z.active_permits if p.type in IGNITION_PERMITS), None)
                label = f"Suspend hot-work permit {pid}" if pid else "Clear ignition source in adjacent zone"
                cands.append(Intervention(label, self._level(min(100.0, s)), reduction(s)))
            if f.personnel > 0:
                s = self._score(f, drop_personnel=True)
                cands.append(Intervention("Evacuate personnel from zone",
                                          self._level(min(100.0, s)), reduction(s)))
            s = self._score(f, ventilate=True)
            cands.append(Intervention("Force ventilation / gas purge",
                                      self._level(min(100.0, s)), reduction(s)))
            interventions = sorted(cands, key=lambda i: -i.delta)

        ignition_ref = ""
        if f.ignition_same:
            p = next((p for p in z.active_permits if p.type in IGNITION_PERMITS), None)
            ignition_ref = p.id if p else "in-zone"
        elif f.ignition_adj:
            ignition_ref = "adjacent"

        return ZoneRisk(zid, z.name, round(score, 1), level, compound, flammable_evidence,
                        factors, ttt, interventions, ignition_ref, f.personnel)
