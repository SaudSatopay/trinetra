"""Demo-safe fallback content for the AI layer.

Trinetra's intelligence layer leans on Gemini for the disaster-memory briefing and
the incident report. Live LLM calls can rate-limit (429) or stall at exactly the
wrong moment — a live jury demo. This module is the safety net: vetted, grounded,
deterministic content that is served when the live call is unavailable, so the
control room degrades to a polished "cached analysis" instead of an error.

Two deliberate design choices live here:
  * The evacuation alert is a FIXED life-safety message. It is pre-translated and
    vetted once, not generated per-call — you never want an LLM improvising the
    words workers act on in an emergency (and it removes a network dependency from
    the critical path entirely).
  * The briefing and incident report have deterministic builders grounded only in
    the data passed to them, so they read as real analysis even offline.
"""
from __future__ import annotations

# ---------------------------------------------------------------------------
# Evacuation alert — fixed, pre-translated, vetted. {zone} is the only variable.
# Telugu + Hindi for a Visakhapatnam plant; zone IDs stay in Latin (as on signage).
# ---------------------------------------------------------------------------
EVAC_TEMPLATES: dict[str, str] = {
    "English": (
        "EMERGENCY - Compound gas / explosion hazard detected in {zone}. All personnel "
        "evacuate immediately via the nearest safe exit. Do NOT operate electrical or "
        "hot-work equipment. Await the all-clear from the control room."
    ),
    "Telugu": (
        "అత్యవసరం - {zone}లో సంయుక్త గ్యాస్ / పేలుడు ప్రమాదం గుర్తించబడింది. సిబ్బంది అందరూ "
        "వెంటనే సమీప సురక్షిత నిష్క్రమణ ద్వారా బయటకు వెళ్లండి. ఎటువంటి విద్యుత్ లేదా హాట్-వర్క్ "
        "పరికరాలను ఆపరేట్ చేయవద్దు. కంట్రోల్ రూమ్ నుండి ఆల్-క్లియర్ సంకేతం కోసం వేచి ఉండండి."
    ),
    "Hindi": (
        "आपातकाल - {zone} में संयुक्त गैस / विस्फोट का खतरा पाया गया है। सभी कर्मी तुरंत "
        "निकटतम सुरक्षित निकास से बाहर निकलें। किसी भी बिजली या हॉट-वर्क उपकरण का संचालन न करें। "
        "नियंत्रण कक्ष से ऑल-क्लियर संकेत की प्रतीक्षा करें।"
    ),
}


def evacuation_alert(zone_name: str, languages=("Telugu", "Hindi")) -> dict:
    """Vetted multilingual evacuation alert. No LLM — deterministic and instant."""
    out = {"English": EVAC_TEMPLATES["English"].format(zone=zone_name)}
    for lang in languages:
        tmpl = EVAC_TEMPLATES.get(lang)
        out[lang] = tmpl.format(zone=zone_name) if tmpl else "(translation unavailable)"
    return out


# ---------------------------------------------------------------------------
# Briefings — what disaster memory says when Gemini is unavailable.
# ---------------------------------------------------------------------------
def vizag_briefing(zone_name: str) -> str:
    """Hand-authored hero briefing for the Visakhapatnam coke-oven scenario."""
    return (
        f"The conditions now developing in {zone_name} - flammable coke-oven gas "
        "accumulating while a hot-work permit and a confined-space entry remain "
        "simultaneously active - mirror the precursors of the 13 January 2025 "
        "Visakhapatnam Steel Plant explosion, in which eight workers died when "
        "entrapped coke-oven gas met an ignition source. As at Visakhapatnam, every "
        "individual sensor still reads within limits; the lethality is in the "
        "combination. The single most important action is to suspend the hot-work "
        "permit and evacuate the confined space until the atmosphere is verified gas-free."
    )


def _lower_first(s: str) -> str:
    s = s.strip().rstrip(".")
    return (s[:1].lower() + s[1:]) if s else s


def build_briefing(zone_name: str, incident: dict) -> str:
    """Deterministic, grounded briefing from a matched precedent (no LLM)."""
    return (
        f"The live condition in {zone_name} echoes the precursors of "
        f"{incident['title']} ({incident['date']}, {incident['location']}), in which "
        f"{_lower_first(incident['event'])}. The documented root cause was "
        f"{_lower_first(incident['root_cause'])}. No single reading is yet in alarm - "
        "the danger is in the combination. Priority action: remove the ignition "
        "pathway and verify a safe atmosphere before any further work, the control "
        f"whose absence led to {_lower_first(incident['casualties'])}."
    )


# ---------------------------------------------------------------------------
# Incident report — regulator-ready preliminary report when Gemini is unavailable.
# Built only from the provided event data; cites real, applicable provisions.
# ---------------------------------------------------------------------------
def build_report(event: dict) -> str:
    factors = event.get("factors", []) or []
    factor_lines = "\n".join(f"- {f}" for f in factors) if factors else "- (no individual sensor in alarm)"
    permits = event.get("permits") or ["(none recorded)"]
    summary_factors = "; ".join(_lower_first(f) for f in factors[:3]) if factors else "the observed conditions"

    return f"""1. Summary
At T+{event['t_min']} min the Trinetra compound-risk system detected a {event['level'].upper()}-level compound hazard in {event['zone']} ({event['zone_kind']}) at {event['facility']}, overall risk score {event['score']}/100. The pattern was identified BEFORE any single sensor crossed its statutory alarm threshold; at the observed rate a threshold breach was projected within ~{event['ttt']} min. This documents a prevented near-miss.

2. Conditions Detected
{factor_lines}
Active permits at detection: {", ".join(permits)}. Personnel in zone: {event['personnel']}.

3. Compound Risk Assessment
No individual gas reading was in alarm, yet the convergence of {summary_factors} constitutes a recognised pre-ignition pattern: a flammable/toxic atmosphere, an ignition pathway, and personnel exposure occurring together. Closest historical precedent: {event['precedent']}. This same convergence is implicated in that precedent.

4. Immediate Actions
- Suspend all hot-work and ignition-source permits in the zone and its blast radius.
- Evacuate personnel from the affected and adjacent zones; account for all entrants.
- Increase forced ventilation / purge and maintain continuous gas monitoring.
- Activate the emergency response team and isolate the source.

5. Regulatory References (Factory Act 1948 / OISD)
- Factory Act 1948, Section 36 - precautions against dangerous fumes, gases and vapours in confined spaces.
- Factory Act 1948, Section 37 - precautions against explosive or flammable gas, dust or vapour.
- Factory Act 1948, Section 38 - fire-precaution and means-of-escape provisions.
- OISD-STD-105 - work-permit system: hot-work and confined-space entry must not co-exist with an unverified atmosphere.

6. Corrective Actions
- Enforce a cross-permit interlock: hot-work and confined-space entry cannot remain simultaneously active in the same zone or blast radius.
- Require gas-free verification before any hot work, with re-testing at defined intervals.
- Embed compound-risk monitoring in the permit-to-work approval workflow.
- Brief all shift personnel on this prevented near-miss."""
