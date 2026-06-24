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
  * cross-zone blast-radius reasoning — ignition OR exposed personnel in an ADJACENT
    zone still counts (people next door to a blast are inside the blast radius too).

Deterministic given the simulator seed → the WP2 benchmark numbers are reproducible.
"""
from __future__ import annotations

import random
from collections import deque
from dataclasses import dataclass, replace
from typing import Optional

from ..constants import FLAMMABLE_GASES, GAS_THRESHOLDS, SENSOR_NOISE, ZONES
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
LOC_O2 = 11.0                    # limiting oxygen concentration (%vol): below this an inerted /
                                 # purged zone cannot sustain a flammable explosion — the oxidizer
                                 # leg of the fire triangle. Fuel + ignition + crew is NOT enough.
O2_ASPHYXIA = 16.0               # %vol: at/below this an UNPROTECTED person is in immediate oxygen-
                                 # deficiency danger. Asphyxiation is its own life-safety compound
                                 # (the leading confined-space killer), independent of any explosion.
CONF_SAMPLES = 128               # Monte-Carlo draws for calibrated confidence
INERTED_DISPLAY_CAP = 45.0       # a genuinely inerted, supplied-air zone is a CONTROLLED high-hazard
                                 # operation (both compound pathways closed) — hold its DISPLAY risk in
                                 # the ELEVATED band so a controlled zone doesn't read as a live critical
                                 # emergency. (Other non-compound zones may still colour by their continuous
                                 # danger; the emergency HALO is separately gated on the compound verdict.)


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
    personnel: int          # personnel inside the hazard zone
    personnel_adj: int      # personnel in adjacent zones — exposed within the blast radius
    confined: bool
    fastest_gas: Optional[str]
    fastest_slope_raw: float  # in the gas's own unit per minute
    o2_value: float           # raw O2 reading (%vol) — for the fire-triangle oxidizer check
    breathing_protected: bool # crew on supplied air / SCBA (an intended, protected inerted entry)
    o2_sustained: bool        # O2 deficiency persists (not a single-sample glitch) — gates asphyxiation


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
    confidence: Optional[float] = None   # P(the compound call holds) under the sensor-noise model
    ttt_spread: Optional[float] = None   # std of the projected-breach estimate (minutes)


class CompoundRiskEngine:
    def __init__(self, window: int = WINDOW, compute_confidence: bool = False):
        self.window = window
        self.compute_confidence = compute_confidence  # off in the benchmark (fast, deterministic)
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
        # personnel in adjacent zones are within the blast radius of an explosion here
        personnel_adj = sum(snap.zones[n].worker_count
                            for n in ZONES[zid].neighbours if n in snap.zones)
        confined = (ZONES[zid].kind == "confined_space"
                    or any(p.type == PermitType.CONFINED_SPACE for p in z.active_permits))
        breathing_protected = any(getattr(p, "supplied_air", False)
                                  for p in z.active_permits if p.type == PermitType.CONFINED_SPACE)
        # asphyxiation needs a SUSTAINED deficiency, not a one-sample dropout: O2 below the
        # immediate-danger line now AND already below the 19.5% OSHA deficiency line one sample
        # back (i.e. genuinely depleting). This makes the O2 leg symmetric with the flammable leg
        # (level + trend). Requiring a REAL prior sample (fail-closed on cold start) means a lone
        # faulty/transient low O2 reading — or a first ingested row that happens to be low — cannot
        # manufacture a phantom asphyxiation alert; a genuine deficiency persists and fires next sample.
        o2_now = z.gases["O2"].value
        h = self._hist[zid]
        o2_prev = h[-2][1]["O2"] if len(h) >= 2 else None
        o2_sustained = (o2_now < O2_ASPHYXIA and o2_prev is not None
                        and o2_prev < GAS_THRESHOLDS["O2"].low_alarm)
        return _Features(flam_level, flam_slope, toxic_level, o2_deficit,
                         ignition_same, ignition_adj, z.worker_count, personnel_adj, confined,
                         fastest, fastest_raw, o2_now, breathing_protected, o2_sustained)

    # -- scoring (uncapped; with counterfactual switches) --------------------
    def _score(self, f: _Features, *, drop_ignition=False, drop_personnel=False,
               ventilate=False) -> float:
        flam_level = f.flam_level * (0.4 if ventilate else 1.0)
        flam_slope = f.flam_slope * (0.2 if ventilate else 1.0)
        # ventilation/purge restores oxygen as well as diluting fuel, so the counterfactual relaxes
        # the O2 deficit toward ambient too — otherwise the % "credit" for an O2-deficiency hazard
        # would come from diluting background gas, not from the remedy that actually matters (fresh air).
        o2_deficit = f.o2_deficit * (0.3 if ventilate else 1.0)
        a_flam = max(0.0, flam_level - FLOOR_FLAM)      # abnormal flammable level (background removed)
        m_flam = max(0.0, flam_slope * LOOKAHEAD)       # projected rise over the lookahead
        a_tox = max(0.0, f.toxic_level - FLOOR_TOXIC)
        raw = W_LEVEL * a_flam + W_SLOPE * m_flam + W_TOXIC * a_tox + W_O2 * o2_deficit
        ign = 0.0 if drop_ignition else (M_IGNITION_SAME * f.ignition_same
                                         + M_IGNITION_ADJ * f.ignition_adj)
        per = 0.0 if drop_personnel else (M_PERSONNEL if f.personnel > 0 else 0.0)
        conf = M_CONFINED * o2_deficit if f.confined else 0.0
        return 100.0 * raw * (1.0 + ign + per + conf)   # uncapped on purpose

    @staticmethod
    def _level(score: float) -> RiskLevel:
        for thr, lvl in LEVEL_BANDS:
            if score >= thr:
                return lvl
        return RiskLevel.NORMAL

    @staticmethod
    def _verdict(flam_evidence: bool, ignition: bool, personnel_exposed: bool,
                 personnel: int, o2_value: float, protected: bool,
                 o2_sustained: bool) -> tuple[bool, bool]:
        """The life-safety compound gate as (explosion, asphyxiation) — the single source of truth.

        Fire triangle: a flammable explosion needs fuel + ignition + oxidizer + people in the blast
        radius. The zone is treated as genuinely inerted (no oxidizer) ONLY when the low O2 is
        operationally explained — a supplied-air inerted entry — so a lone low O2 reading can never
        silently suppress a real explosion alert (otherwise it is treated as a suspect sensor).
        Asphyxiation: unprotected people breathing an oxygen-deficient atmosphere are dying now,
        regardless of any explosion — its own compound (the leading confined-space killer). It
        requires a SUSTAINED deficiency (o2_sustained), symmetric with the flammable leg's level +
        trend, so a single faulty/transient low O2 sample can't fabricate a phantom asphyxiation."""
        inerted = (o2_value < LOC_O2) and protected
        explosion = flam_evidence and ignition and personnel_exposed and not inerted
        asphyxiation = (o2_value < O2_ASPHYXIA) and o2_sustained and personnel > 0 and not protected
        return explosion, asphyxiation

    # -- calibrated confidence ----------------------------------------------
    def _confidence(self, z, f: _Features, seed: int):
        """Monte-Carlo the compound call over the sensor-noise model: if every reading
        is jittered by its sensor's own noise, how often does the compound verdict still
        hold? Returns (confidence 0..1, projected-breach std in minutes). Deterministic
        given the seed, so it stays reproducible."""
        exp0, asph0 = self._verdict(
            (f.flam_level >= COMPOUND_PRESENT_FRAC and f.flam_slope > COMPOUND_SLOPE)
            or f.flam_level >= COMPOUND_HIGH_FRAC,
            f.ignition_same or f.ignition_adj, f.personnel > 0 or f.personnel_adj > 0,
            f.personnel, f.o2_value, f.breathing_protected, f.o2_sustained)
        nominal = bool(exp0 or asph0)
        rng = random.Random(seed)
        agree = 0
        ttts: list[float] = []
        for _ in range(CONF_SAMPLES):
            flam = 0.0
            for sp in FLAMMABLE_GASES:
                v = z.gases[sp].value + rng.gauss(0.0, SENSOR_NOISE[sp])
                flam = max(flam, v / GAS_THRESHOLDS[sp].low_alarm)
            co = (z.gases["CO"].value + rng.gauss(0.0, SENSOR_NOISE["CO"])) / GAS_THRESHOLDS["CO"].low_alarm
            h2s = (z.gases["H2S"].value + rng.gauss(0.0, SENSOR_NOISE["H2S"])) / GAS_THRESHOLDS["H2S"].low_alarm
            o2v = z.gases["O2"].value + rng.gauss(0.0, SENSOR_NOISE["O2"])
            o2d = max(0.0, (O2_AMBIENT - o2v) / (O2_AMBIENT - 16.0))
            fp = replace(f, flam_level=flam, toxic_level=max(co, h2s), o2_deficit=o2d)
            ev = ((fp.flam_level >= COMPOUND_PRESENT_FRAC and fp.flam_slope > COMPOUND_SLOPE)
                  or fp.flam_level >= COMPOUND_HIGH_FRAC)
            exp, asph = self._verdict(ev, fp.ignition_same or fp.ignition_adj,
                                      fp.personnel > 0 or fp.personnel_adj > 0, fp.personnel,
                                      o2v, fp.breathing_protected, fp.o2_sustained)
            comp = bool(exp or asph)
            if comp == nominal:
                agree += 1
            if f.fastest_gas and f.fastest_slope_raw > 0.01:
                thr = GAS_THRESHOLDS[f.fastest_gas]
                cur = z.gases[f.fastest_gas].value + rng.gauss(0.0, SENSOR_NOISE[f.fastest_gas])
                # the trend itself is a finite difference over noisy history -> jitter it too
                slope = f.fastest_slope_raw + rng.gauss(0.0, SENSOR_NOISE[f.fastest_gas] * 1.414 / self.window)
                if cur < thr.danger and slope > 0.1:
                    ttts.append((thr.danger - cur) / slope)
        conf = round(agree / CONF_SAMPLES, 3)
        spread = None
        if len(ttts) >= 8:
            m = sum(ttts) / len(ttts)
            spread = round((sum((x - m) ** 2 for x in ttts) / len(ttts)) ** 0.5, 1)
        return conf, spread

    # -- per-zone assessment -------------------------------------------------
    def _assess_zone(self, zid: str, snap: PlantSnapshot) -> ZoneRisk:
        z = snap.zones[zid]
        f = self._features(zid, snap)
        raw = self._score(f)
        score = min(100.0, raw)

        flammable_evidence = ((f.flam_level >= COMPOUND_PRESENT_FRAC and f.flam_slope > COMPOUND_SLOPE)
                              or f.flam_level >= COMPOUND_HIGH_FRAC)
        ignition = f.ignition_same or f.ignition_adj
        # people are in danger inside the zone OR within the blast radius next door
        personnel_exposed = f.personnel > 0 or f.personnel_adj > 0
        explosion, asphyxiation = self._verdict(flammable_evidence, ignition, personnel_exposed,
                                                f.personnel, f.o2_value, f.breathing_protected,
                                                f.o2_sustained)
        compound = bool(explosion or asphyxiation)
        oxidizer = f.o2_value >= LOC_O2
        inerted = (not oxidizer) and f.breathing_protected          # genuine, protected inerting
        o2_suspect = (not oxidizer) and not f.breathing_protected   # low O2 with no inerting context

        # Display: a genuinely inerted, supplied-air zone is a CONTROLLED high-hazard operation, not
        # a live emergency — the explosion pathway (no oxidizer) and the asphyxiation pathway (crew
        # protected) are both closed, so the realized compound risk is low even though the raw flammable
        # inventory reads high (still shown in telemetry/factors). Hold THIS controlled zone's displayed
        # risk in the ELEVATED band so it doesn't read as a live critical emergency. (Other non-compound
        # zones still colour by their continuous danger — e.g. a zone trending toward asphyxiation reads
        # high before the verdict locks; the emergency HALO is what's gated on the compound verdict in the
        # UI.) Detection is unchanged: the compound gate already returned False; the benchmark scores it.
        if inerted:
            score = min(score, INERTED_DISPLAY_CAP)
        level = self._level(score)

        factors: list[str] = []
        if f.flam_slope > COMPOUND_SLOPE and f.fastest_gas and f.flam_level >= COMPOUND_PRESENT_FRAC:
            pct = int(f.flam_level * 100)
            qualifier = f"still only {pct}% of alarm (sub-threshold)" if f.flam_level < 1.0 else f"now {pct}% of alarm"
            factors.append(f"{f.fastest_gas} rising {f.fastest_slope_raw:+.1f}/min, {qualifier}")
        elif f.flam_level >= COMPOUND_HIGH_FRAC:
            factors.append(f"flammable gas at {int(f.flam_level * 100)}% of alarm")
        if f.ignition_same:
            factors.append("active ignition source (hot-work) in zone")
        elif f.ignition_adj:
            factors.append("ignition source in adjacent zone (within blast radius)")
        if f.personnel > 0:
            factors.append(f"{f.personnel} personnel present")
        elif f.personnel_adj > 0:
            factors.append(f"{f.personnel_adj} personnel in an adjacent zone (within blast radius)")
        if f.confined and f.o2_deficit > 0.1 and not asphyxiation and not inerted and not o2_suspect:
            factors.append(f"confined space, O2 down to {z.gases['O2'].value:.1f}%")
        if f.toxic_level >= 1.0:
            factors.append("toxic gas above exposure limit")
        # O2 / oxidizer reasoning — exactly one branch fires, so the surface never carries a
        # contradictory pair (e.g. "asphyxiation hazard" AND "suspect sensor" for the same reading).
        if inerted:
            factors.append(f"zone inerted (O2 {f.o2_value:.1f}% < {LOC_O2:.0f}% LOC) with crew on supplied "
                           f"air — no oxidizer for an explosion and the crew is protected; compound risk "
                           f"controlled (raw flammable gas still elevated — see telemetry)")
        elif o2_suspect:
            # a sub-LOC O2 with no inerting permit is UNVERIFIED: act on it (it may be a real
            # deficiency) AND never let it suppress the explosion alert (it may be a faulty sensor).
            bits = []
            if asphyxiation:
                bits.append(f"held as a potential asphyxiation hazard for {f.personnel} unprotected personnel")
            if flammable_evidence and ignition and personnel_exposed:
                bits.append("the explosion alert is NOT suppressed")
            tail = "; ".join(bits) if bits else "treated as unverified"
            factors.append(f"O2 reads {f.o2_value:.1f}% with no inerting permit — {tail} (verify the atmosphere)")
        elif asphyxiation:
            factors.append(f"O2 {f.o2_value:.1f}% — oxygen-deficient atmosphere with "
                           f"{f.personnel} unprotected personnel: asphyxiation hazard")
        # ventilation guidance only when sub-LOC, where ventilating would re-introduce the oxidizer;
        # when an oxidizer is already present (O2 >= LOC) ventilation/purge is a valid control, so the
        # "Force ventilation" intervention below and this warning never both appear.
        if (not oxidizer) and flammable_evidence and f.personnel > 0:
            if inerted:
                factors.append("do NOT ventilate — hold the inert state; ventilating would re-introduce "
                               "the oxidizer to a flammable atmosphere")
            else:
                factors.append("do NOT ventilate — it would re-introduce the oxidizer to a flammable "
                               "atmosphere; evacuate and verify before any purge")

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
            if ignition and explosion:
                s = self._score(f, drop_ignition=True)
                pid = next((p.id for p in z.active_permits if p.type in IGNITION_PERMITS), None)
                label = f"Suspend hot-work permit {pid}" if pid else "Clear ignition source in adjacent zone"
                cands.append(Intervention(label, self._level(min(100.0, s)), reduction(s)))
            if f.personnel > 0 and compound:
                # evacuation is a compound-hazard response — never recommend it for a non-compound
                # (e.g. inerted, controlled) zone, even when its raw score is high.
                s = self._score(f, drop_personnel=True)
                cands.append(Intervention("Evacuate personnel from zone",
                                          self._level(min(100.0, s)), reduction(s)))
            if oxidizer and not asphyxiation:
                # ventilation/purge is valid only when an oxidizer is present AND the zone is not
                # already an occupied O2-deficient space — there the answer is Evacuate now, not
                # ventilate-while-people-breathe-it; and never ventilate an inerted flammable atmosphere.
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

        confidence = ttt_spread = None
        if self.compute_confidence and score >= 20:
            seed = (int(round(snap.t_min * 100)) * 1000003 + sum(ord(c) for c in zid)) & 0x7FFFFFFF
            confidence, ttt_spread = self._confidence(z, f, seed)

        return ZoneRisk(zid, z.name, round(score, 1), level, compound, flammable_evidence,
                        factors, ttt, interventions, ignition_ref, f.personnel,
                        confidence, ttt_spread)
