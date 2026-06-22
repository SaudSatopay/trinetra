"""Serialize the digital twin + engine output into JSON the dashboard consumes."""
from __future__ import annotations

from ..constants import GAS_THRESHOLDS, PLANT_NAME, ZONES
from ..domain import GasReading, PlantSnapshot, ZoneState
from ..engine import ZoneRisk


def plant_layout() -> dict:
    """Static plant geometry for the geospatial map (sent once on load)."""
    return {
        "name": PLANT_NAME,
        "zones": [
            {"id": z.id, "name": z.name, "kind": z.kind, "x": z.x, "y": z.y,
             "neighbours": list(z.neighbours)}
            for z in ZONES.values()
        ],
        "thresholds": {
            sp: {"unit": t.unit, "low": t.low_alarm, "high": t.high_alarm,
                 "danger": t.danger, "direction": t.direction, "flammable": t.flammable}
            for sp, t in GAS_THRESHOLDS.items()
        },
    }


def _gas(reading: GasReading) -> dict:
    thr = GAS_THRESHOLDS[reading.species]
    return {"species": reading.species, "value": reading.value, "unit": reading.unit,
            "stage": thr.stage(reading.value), "frac": round(reading.value / thr.low_alarm, 3)}


def _zone(z: ZoneState, risk: ZoneRisk) -> dict:
    return {
        "id": z.zone_id, "name": z.name, "kind": z.kind, "x": z.x, "y": z.y,
        "gases": {sp: _gas(r) for sp, r in z.gases.items()},
        "temperature": z.temperature, "pressure": z.pressure,
        "workers": z.worker_ids,
        "permits": [{"id": p.id, "type": p.type.value, "description": p.description}
                    for p in z.active_permits],
        "risk": {
            "score": risk.score, "level": risk.level.value, "compound": risk.compound,
            "factors": risk.factors, "time_to_threshold_min": risk.time_to_threshold_min,
            "ignition_ref": risk.ignition_ref,
            "interventions": [
                {"action": i.action, "resulting_level": i.resulting_level.value, "delta": i.delta}
                for i in risk.interventions
            ],
        },
    }


def serialize_frame(snap: PlantSnapshot, risks: dict[str, ZoneRisk]) -> dict:
    zones = [_zone(snap.zones[zid], risks[zid]) for zid in snap.zones]
    top = max(zones, key=lambda z: z["risk"]["score"]) if zones else None
    compound_alert = any(z["risk"]["compound"] and z["risk"]["score"] >= 40 for z in zones)
    baseline_alarm = any(g["stage"] for z in zones for g in z["gases"].values())
    return {
        "t_min": snap.t_min,
        "scenario": snap.scenario,
        "zones": zones,
        "summary": {
            "top_zone": top["id"] if top else None,
            "top_score": top["risk"]["score"] if top else 0,
            "top_level": top["risk"]["level"] if top else "normal",
            "compound_alert": compound_alert,     # Trinetra is escalating now
            "baseline_alarm": baseline_alarm,     # a legacy single-sensor system would alarm now
            "shift_handover": snap.shift_handover,  # a shift changeover is in progress
        },
    }
