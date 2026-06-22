"""Smoke test: run the LangGraph multi-agent pipeline on a live Vizag compound state."""
from app.agents.graph import run_pipeline
from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator


def main():
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], seed=42)
    engine = CompoundRiskEngine()
    snap = risk = None
    for snap in sim.run(13):
        risk = engine.assess(snap)["COB-1"]

    out = run_pipeline(snap, "COB-1", risk)

    print("=== AGENT PIPELINE TRACE (LangGraph) ===")
    for i, t in enumerate(out["trace"], 1):
        print(f"  {i}. {t}")

    prec = out.get("precedent", {})
    print(f"\nContext/RAG  : {int(prec.get('similarity', 0) * 100)}% -> {prec.get('title')}")
    print("Response     :")
    for a in out.get("response", {}).get("actions", []):
        print(f"   - {a}")


if __name__ == "__main__":
    main()
