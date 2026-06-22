"""Auto-drafted incident report + multilingual emergency alerts (Gemini).

The payoff of the compound-risk detection: when a hazard is caught, Trinetra
doesn't just alarm - it drafts a regulator-ready preliminary report and pushes
an evacuation alert in the languages the workers on the floor actually speak
(Telugu + Hindi for a Visakhapatnam plant). Accessibility as a feature.
"""
from __future__ import annotations

from .gemini import GeminiError, generate

REPORT_SYSTEM = (
    "You are a plant safety officer drafting a PRELIMINARY incident / near-miss report "
    "compliant with the Indian Factory Act 1948 and OISD standards. Write formally and "
    "factually using only the data provided - do not invent specifics. Cite specific "
    "regulatory provisions only where genuinely applicable."
)


def draft_incident_report(event: dict) -> str:
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
    return generate(prompt, system=REPORT_SYSTEM, temperature=0.3, timeout=90)


def evacuation_alert(zone_name: str, languages=("Telugu", "Hindi")) -> dict:
    base = (
        f"EMERGENCY - Compound gas / explosion hazard detected in {zone_name}. All personnel "
        "evacuate immediately via the nearest safe exit. Do NOT operate electrical or hot-work "
        "equipment. Await the all-clear from the control room."
    )
    out = {"English": base}
    for lang in languages:
        try:
            out[lang] = generate(
                f"Translate this plant emergency evacuation alert into {lang}. "
                f"Output ONLY the translation, nothing else:\n\n{base}",
                temperature=0.1,
                timeout=40,
            )
        except GeminiError:
            out[lang] = "(translation unavailable)"
    return out
