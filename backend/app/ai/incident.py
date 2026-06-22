"""Auto-drafted incident report + multilingual emergency alerts (Gemini).

The payoff of the compound-risk detection: when a hazard is caught, Trinetra
doesn't just alarm - it drafts a regulator-ready preliminary report and pushes
an evacuation alert in the languages the workers on the floor actually speak
(Telugu + Hindi for a Visakhapatnam plant). Accessibility as a feature.
"""
from __future__ import annotations

from . import golden
from .gemini import GeminiError, generate

REPORT_SYSTEM = (
    "You are a plant safety officer drafting a PRELIMINARY incident / near-miss report "
    "compliant with the Indian Factory Act 1948 and OISD standards. Write formally and "
    "factually using only the data provided - do not invent specifics. Cite specific "
    "regulatory provisions only where genuinely applicable."
)


def draft_incident_report(event: dict) -> tuple[str, bool]:
    """Return (report text, degraded). Falls back to a deterministic, grounded
    report (built only from `event`) when Gemini is unavailable."""
    factors = "\n".join(f"- {f}" for f in event.get("factors", []))
    prompt = f"""Draft a PRELIMINARY compound-hazard report. This hazard was caught BEFORE escalation by the Trinetra compound-risk intelligence system, so frame it as a prevented near-miss.

Facility: {event['facility']}
Zone: {event['zone']} ({event['zone_kind']})
Detected at: T+{event['t_min']} min
Compound risk: {event['level'].upper()} (score {event['score']}/100)
Predicted threshold breach: ~{event['ttt']} min at the observed rate
Active permits: {event['permits']}
Personnel in zone: {event['personnel']}
Closest historical precedent: {event['precedent']}

Detected conditions:
{factors}

Use exactly these numbered headings: 1. Summary  2. Conditions Detected  3. Compound Risk Assessment  4. Immediate Actions  5. Regulatory References (Factory Act 1948 / OISD)  6. Corrective Actions. Keep it under 320 words."""
    try:
        return generate(prompt, system=REPORT_SYSTEM, temperature=0.3, timeout=90), False
    except GeminiError:
        return golden.build_report(event), True


def evacuation_alert(zone_name: str, languages=("Telugu", "Hindi")) -> dict:
    """Vetted, pre-translated evacuation alert (no LLM — see app/ai/golden.py)."""
    return golden.evacuation_alert(zone_name, languages)
