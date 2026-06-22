"""Smoke test: match a live Vizag-style compound condition to historical disasters."""
from app.ai.disaster_memory import DisasterMemory, condition_from_factors
from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator


def main():
    # run the hero scenario to the moment the compound alert is firing (~t12)
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], seed=42)
    engine = CompoundRiskEngine()
    risk = None
    for snap in sim.run(13):
        risk = engine.assess(snap)["COB-1"]

    condition = condition_from_factors("Coke Oven Battery #1", risk.factors)
    print("LIVE CONDITION:\n ", condition, "\n")

    mem = DisasterMemory()
    matches = mem.match(condition, k=3)
    print("CLOSEST HISTORICAL PRECEDENTS:")
    for m in matches:
        print(f"  {int(m.similarity * 100):>3}%  {m.incident['title']} ({m.incident['date']})")

    print("\nGEMINI BRIEFING (grounded in the top match):")
    print(" ", mem.briefing(condition, matches[0]))


if __name__ == "__main__":
    main()
