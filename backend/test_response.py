"""Smoke test: auto-drafted incident report + multilingual alert for a Vizag compound state."""
from app.ai.incident import draft_incident_report, evacuation_alert
from app.constants import PLANT_NAME, ZONES
from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator


def main():
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], seed=42)
    engine = CompoundRiskEngine()
    snap = risk = None
    for snap in sim.run(13):
        risk = engine.assess(snap)["COB-1"]

    z = snap.zones["COB-1"]
    event = {
        "facility": PLANT_NAME, "zone": "COB-1", "zone_kind": ZONES["COB-1"].kind,
        "t_min": int(snap.t_min), "level": risk.level.value, "score": int(risk.score),
        "ttt": int(risk.time_to_threshold_min or 0),
        "permits": [f"{p.id} ({p.type.value})" for p in z.active_permits],
        "personnel": len(z.worker_ids), "factors": risk.factors,
        "precedent": "Visakhapatnam Steel Plant coke-oven explosion (2025) - 82% match",
    }

    print("=== AUTO-DRAFTED INCIDENT REPORT ===\n")
    print(draft_incident_report(event))
    print("\n=== MULTILINGUAL EVACUATION ALERT ===")
    for lang, text in evacuation_alert(z.name).items():
        print(f"\n[{lang}] {text}")


if __name__ == "__main__":
    main()
