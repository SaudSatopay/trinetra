"""Smoke test: prove the Gemini integration works end-to-end with the real key."""
from app.ai.gemini import MODEL, generate

SYSTEM = (
    "You are a senior industrial process-safety engineer specialising in coke-oven and "
    "steel-plant operations. Be precise and factual. Reference the hazard mechanism. "
    "No hedging, no preamble."
)

PROMPT = """Compound hazard developing at COB-1 (Coke Oven Battery #1):
- CH4 rising, now ~50% of the LEL alarm and climbing ~0.7 %LEL/min (still below the single-sensor alarm)
- Active hot-work permit (welding) in the zone — an ignition source
- 3 personnel inside a confined space below the battery
- O2 beginning to deplete

In 3 sentences: explain why THIS specific combination is lethal (not any single reading),
and state the one action that most reduces the risk."""


def main():
    print(f"model: {MODEL}\n")
    print(generate(PROMPT, system=SYSTEM))


if __name__ == "__main__":
    main()
