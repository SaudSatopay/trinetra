"""Shift-left permit-issuance gate.

Most permit-to-work systems clear a job against single-sensor setpoints: if the gas
reading is below alarm, the permit is issued. Trinetra's gate runs the SAME compound
engine *at the permit desk* — before anyone strikes an arc — by simulating the plant
state with the proposed permit added and asking: would issuing this permit, right now,
create a lethal compound hazard?

This is the inverse of the engine's counterfactual interventions. Instead of "which
active factor, removed, lowers the risk most", it asks "would adding this factor tip a
quiet-but-loaded zone into the compound pattern?" — and refuses the permit if so.

The Vizag lesson, made preventive: a hot-work permit was issued beside a coke-oven full
of slowly-rising flammable gas with a confined-space crew below. Each reading was below
alarm, so the desk cleared it. Evaluated here against that same atmosphere, the gate
blocks the permit minutes before any single sensor would alarm — the danger is the
combination the permit completes, not any one reading.

No engine change: the gate composes the existing assess() over a hypothetical snapshot,
so the benchmark is untouched.
"""
from __future__ import annotations

from dataclasses import replace as dc_replace

from .constants import ZONES
from .domain import IGNITION_PERMITS, OCCUPANCY_PERMITS, Permit, PermitType, RiskLevel
from .engine import CompoundRiskEngine
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

PROPOSED_ID = "PTW-PROPOSED"
# realistic crew the permit itself brings, if the caller doesn't override it
DEFAULT_WORKERS = {
    PermitType.HOT_WORK: 1, PermitType.CONFINED_SPACE: 2, PermitType.MAINTENANCE: 1,
    PermitType.ELECTRICAL: 1, PermitType.WORKING_AT_HEIGHT: 1,
}


def _remove_permit_type(snap, zone: str, pt: PermitType):
    """The permit-desk baseline: the zone as it stands *before* this permit is issued —
    any already-modelled permit of the same type stripped out, so we measure the marginal
    effect of issuing it (and don't double-count the very permit we're evaluating)."""
    z = snap.zones[zone]
    kept = [p for p in z.active_permits if p.type != pt]
    dropped_worker_ids = {w for p in z.active_permits if p.type == pt for w in p.worker_ids}
    worker_ids = [w for w in z.worker_ids if w not in dropped_worker_ids]
    new_z = dc_replace(z, active_permits=kept, worker_ids=worker_ids)
    zones = dict(snap.zones)
    zones[zone] = new_z
    permits = [p for p in snap.permits if not (p.zone_id == zone and p.type == pt)]
    return dc_replace(snap, zones=zones, permits=permits)


def _inject_permit(snap, zone: str, permit: Permit):
    z = snap.zones[zone]
    worker_ids = list(z.worker_ids) + [w for w in permit.worker_ids if w not in z.worker_ids]
    new_z = dc_replace(z, active_permits=list(z.active_permits) + [permit], worker_ids=worker_ids)
    zones = dict(snap.zones)
    zones[zone] = new_z
    return dc_replace(snap, zones=zones, permits=list(snap.permits) + [permit])


def _primed_engine_and_final(scenario: str, at_min: int):
    """Replay the scenario's gas history up to `at_min` so the engine's trend window is
    correct, and return (engine primed through at_min-1, the real snapshot at at_min).
    Permits never affect gas readings, so the history is identical across hypotheticals."""
    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    snaps = list(sim.run(at_min + 1))  # t = 0 .. at_min
    engine = CompoundRiskEngine(compute_confidence=False)
    for s in snaps[:-1]:
        engine.assess(s)  # prime the trend window (gas only)
    return engine, snaps[-1]


def _lvl(risk) -> dict:
    return {"level": risk.level.value, "score": round(risk.score, 1), "compound": risk.compound}


def evaluate_permit(scenario: str, at_min: int, zone: str, permit_type: str,
                    workers: int | None = None) -> dict:
    if scenario not in SCENARIOS:
        return {"error": f"unknown scenario '{scenario}'"}
    if zone not in ZONES:
        return {"error": f"unknown zone '{zone}'"}
    try:
        pt = PermitType(permit_type)
    except ValueError:
        return {"error": f"unknown permit type '{permit_type}'",
                "available": [p.value for p in PermitType]}
    at_min = max(0, int(at_min))
    n_workers = DEFAULT_WORKERS.get(pt, 1) if workers is None else max(0, int(workers))

    # baseline = the desk state before issuing; after = baseline + the proposed permit
    eng_a, final = _primed_engine_and_final(scenario, at_min)
    eng_b, _ = _primed_engine_and_final(scenario, at_min)
    base_snap = _remove_permit_type(final, zone, pt)
    wids = [f"{PROPOSED_ID}-W{i + 1}" for i in range(n_workers)]
    proposed = Permit(PROPOSED_ID, pt, zone, wids, start_min=at_min, duration_min=60,
                      description=f"Proposed {pt.value.replace('_', ' ')} in {zone}")
    after_snap = _inject_permit(base_snap, zone, proposed)

    base_all = eng_a.assess(base_snap)
    after_all = eng_b.assess(after_snap)

    def is_alert(r) -> bool:
        return r.compound and r.score >= 40

    # only the proposed zone and its blast-radius neighbours can be affected by this permit
    scope = [zone] + [n for n in ZONES[zone].neighbours if n in after_all]
    compound_after = [z for z in scope if is_alert(after_all[z])]
    new_compound = [z for z in compound_after if not is_alert(base_all[z])]   # the permit creates it
    pre_existing = [z for z in compound_after if z not in new_compound]       # already a live hazard
    escalated = [z for z in scope
                 if z not in compound_after
                 and after_all[z].level.rank > base_all[z].level.rank
                 and after_all[z].level.rank >= RiskLevel.HIGH.rank]

    # refuse to add ignition or personnel into — or next door to — any compound hazard, whether
    # the permit creates it or it is already live; only escalation-without-compound is conditional.
    if compound_after:
        verdict = "block"
    elif escalated:
        verdict = "allow_with_conditions"
    else:
        verdict = "allow"

    # decision driver: a zone the permit newly endangers, else the proposed zone, else worst in scope
    affected = compound_after or escalated
    created = bool(new_compound)
    driver = (new_compound[0] if new_compound else
              (zone if zone in affected else (affected[0] if affected else zone)))
    after_driver = after_all[driver]

    affected_zones = [
        {"zone": z, "name": after_all[z].name,
         "before_level": base_all[z].level.value, "after_level": after_all[z].level.value,
         "compound": after_all[z].compound, "cross_zone": z != zone}
        for z in affected
    ]

    headline, reason = _explain(verdict, pt, zone, driver, after_driver, created)
    conditions = _conditions(verdict, pt, after_driver) if verdict != "allow" else []

    return {
        "scenario": scenario, "at_min": at_min, "zone": zone,
        "permit_type": pt.value, "workers": n_workers,
        "verdict": verdict, "headline": headline, "reason": reason,
        "before": _lvl(base_all[zone]), "after": _lvl(after_all[zone]),
        "driver_zone": driver, "driver_before": _lvl(base_all[driver]),
        "driver_after": _lvl(after_driver),
        "affected_zones": affected_zones,
        "factors": after_driver.factors,
        "conditions": conditions,
        "regulation": "OISD-STD-105 (gas-free certification) · Factory Act §36–38 (confined "
                      "space / hazardous process) · DGMS hot-work norms",
    }


def _explain(verdict, pt, zone, driver, after_driver, created):
    label = pt.value.replace("_", " ")
    cross = driver != zone
    where = f"{driver} (adjacent — within the blast radius)" if cross else zone
    if verdict == "block":
        if not created:
            # the zone is already a live compound hazard, regardless of this permit
            head = f"BLOCK — {driver} is already a live compound hazard; no {label} permit may be issued in its blast radius"
            reason = (f"{where} already matches the lethal compound pattern (flammable gas + ignition + "
                      f"personnel). Issuing this permit would put more people or another ignition source inside "
                      f"an active hazard. Clear the hazard first; the gate will re-open when it does.")
        else:
            if pt in IGNITION_PERMITS:
                head = f"BLOCK — issuing this {label} permit would introduce an ignition source into a loaded atmosphere"
            elif pt in OCCUPANCY_PERMITS:
                head = f"BLOCK — issuing this {label} permit would place personnel inside a forming compound hazard"
            else:
                head = f"BLOCK — issuing this {label} permit would complete a compound hazard"
            reason = (f"With the permit active, {where} matches the lethal compound pattern — flammable gas + "
                      f"ignition + personnel — that no single sensor will flag until the gas crosses its setpoint. "
                      f"This is the Vizag pattern; the desk should refuse the permit.")
    elif verdict == "allow_with_conditions":
        head = f"CONDITIONAL — this {label} permit materially raises the risk in {where}"
        reason = (f"Issuing it lifts {where} to {after_driver.level.value.upper()} without (yet) completing the "
                  f"full compound pattern. Issue only with the controls below and continuous monitoring.")
    else:
        head = f"CLEAR — this {label} permit does not create a compound hazard at this time"
        reason = (f"With current conditions in {zone}, issuing the permit keeps risk within normal bounds. "
                  f"Trinetra keeps watching; it will escalate the instant the combination forms.")
    return head, reason


def _conditions(verdict, pt, after_driver):
    conds: list[str] = []
    factors = " ".join(after_driver.factors).lower()
    flammable = "alarm" in factors or "flammable" in factors or "rising" in factors
    has_people = "personnel" in factors
    if flammable:
        conds.append("Obtain a gas-free certificate — flammable gas below alarm and trending down "
                     "(OISD-STD-105) — before issue.")
        conds.append("Force-ventilate / purge the zone and re-test the atmosphere.")
    if pt in IGNITION_PERMITS:
        conds.append("Confirm no flammable release is developing in this zone or any adjacent zone "
                     "within the blast radius.")
    if pt in OCCUPANCY_PERMITS or has_people:
        conds.append("Do not authorise entry while an ignition source is active in the blast radius "
                     "(Factory Act §36/37).")
    conds.append("Re-submit to the gate once the atmosphere is verified — Trinetra re-evaluates live.")
    return conds
