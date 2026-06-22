"""Incident Pattern Intelligence.

Cross-references a corpus of near-miss reports + historical incidents (each tagged
with causal factors, root cause and the regulation that was breached) and mines the
RECURRING factor combinations that manual, one-incident-at-a-time investigations
miss — then surfaces them as ranked prevention priorities mapped to OISD / Factory
Act / DGMS provisions.

Deterministic frequency analysis (reproducible); an optional Gemini synthesis adds
a narrative, with a grounded deterministic fallback when the model is unavailable.
"""
from __future__ import annotations

from collections import Counter
from itertools import combinations

from .gemini import GeminiError, generate

FACTOR_LABELS: dict[str, str] = {
    "flammable_gas": "flammable gas accumulation",
    "toxic_gas": "toxic gas (CO / H2S)",
    "o2_deficiency": "oxygen deficiency",
    "hot_work": "hot-work / ignition source",
    "confined_space": "confined-space entry",
    "no_gas_test": "atmosphere not gas-tested",
    "personnel_present": "personnel exposed",
    "permit_conflict": "conflicting simultaneous permits",
    "adjacent_ignition": "ignition in an adjacent zone",
    "warning_ignored": "gas warning not acted on",
    "shift_handover": "shift-changeover / handover gap",
    "ppe_missing": "PPE / monitoring gap",
}

# type: "incident" (actual) or "near_miss"; severity 1-5; regulation = primary breach.
CORPUS: list[dict] = [
    {"title": "Visakhapatnam coke-oven explosion (2025)", "type": "incident", "severity": 5,
     "factors": ["flammable_gas", "toxic_gas", "confined_space", "hot_work", "personnel_present", "warning_ignored"],
     "regulation": "Factory Act 1948 §36", "root_cause": "Entrapped coke-oven gas met an ignition source; warnings not acted on."},
    {"title": "Piper Alpha platform disaster (1988)", "type": "incident", "severity": 5,
     "factors": ["flammable_gas", "hot_work", "permit_conflict", "personnel_present", "no_gas_test"],
     "regulation": "OISD-STD-105", "root_cause": "Two permits-to-work not cross-checked; pump restarted with relief valve removed."},
    {"title": "BP Texas City refinery explosion (2005)", "type": "incident", "severity": 5,
     "factors": ["flammable_gas", "adjacent_ignition", "personnel_present", "warning_ignored"],
     "regulation": "OISD-STD-118", "root_cause": "Hydrocarbon vapour cloud ignited; personnel sited too close."},
    {"title": "Confined-tank H2S fatality (near-miss averted)", "type": "near_miss", "severity": 4,
     "factors": ["toxic_gas", "o2_deficiency", "confined_space", "no_gas_test", "personnel_present"],
     "regulation": "Factory Act 1948 §36", "root_cause": "Entry without verifying atmosphere; H2S above limit."},
    {"title": "Hot-work near gas-cleaning unit (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["flammable_gas", "hot_work", "no_gas_test", "personnel_present"],
     "regulation": "OISD-STD-105", "root_cause": "Welding permit issued without gas-free certificate."},
    {"title": "Welding during shift handover (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["hot_work", "flammable_gas", "shift_handover", "no_gas_test"],
     "regulation": "OISD-STD-105", "root_cause": "Permit re-validated at changeover without re-test; accountability gap."},
    {"title": "Sump entry, O2 18% (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["o2_deficiency", "confined_space", "no_gas_test", "personnel_present"],
     "regulation": "Factory Act 1948 §36", "root_cause": "Oxygen deficiency not detected before entry."},
    {"title": "Blast-furnace CO release (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["toxic_gas", "personnel_present", "warning_ignored"],
     "regulation": "Factory Act 1948 §36", "root_cause": "CO alarm acknowledged but area not cleared."},
    {"title": "Hot-work adjacent to open vent (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["flammable_gas", "hot_work", "adjacent_ignition", "personnel_present"],
     "regulation": "OISD-STD-105", "root_cause": "Hot work in blast radius of a venting line."},
    {"title": "IOC Jaipur depot vapour-cloud explosion (2009)", "type": "incident", "severity": 5,
     "factors": ["flammable_gas", "adjacent_ignition", "personnel_present", "no_gas_test"],
     "regulation": "OISD-STD-117", "root_cause": "Petrol vapour cloud from a transfer line ignited."},
    {"title": "Confined entry, two-permit overlap (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["confined_space", "hot_work", "permit_conflict", "personnel_present"],
     "regulation": "OISD-STD-105", "root_cause": "Hot-work and confined-space entry active in the same vessel."},
    {"title": "NLC Neyveli boiler explosion (2020)", "type": "incident", "severity": 5,
     "factors": ["personnel_present", "warning_ignored", "shift_handover"],
     "regulation": "Factory Act 1948 §38", "root_cause": "Boiler overpressure during operation."},
    {"title": "Methane build-up, alarm muted (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["flammable_gas", "warning_ignored", "personnel_present"],
     "regulation": "Factory Act 1948 §37", "root_cause": "Rising LEL trend acknowledged but not escalated."},
    {"title": "Tank cleaning without standby (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["confined_space", "o2_deficiency", "ppe_missing", "personnel_present"],
     "regulation": "Factory Act 1948 §36", "root_cause": "No standby attendant; SCBA not worn."},
    {"title": "LG Polymers styrene release (2020)", "type": "incident", "severity": 5,
     "factors": ["toxic_gas", "warning_ignored", "personnel_present"],
     "regulation": "Factory Act 1948 §41B", "root_cause": "Loss of temperature control; monitoring inadequate."},
    {"title": "Hot-work permit reissued at changeover (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["hot_work", "shift_handover", "no_gas_test", "flammable_gas"],
     "regulation": "OISD-STD-105", "root_cause": "Outgoing shift's gas test assumed valid by incoming shift."},
    {"title": "Coke sump confined entry (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["confined_space", "toxic_gas", "o2_deficiency", "no_gas_test", "personnel_present"],
     "regulation": "Factory Act 1948 §36", "root_cause": "Atmosphere not continuously monitored during entry."},
    {"title": "Mine gas + electrical work (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["flammable_gas", "hot_work", "no_gas_test", "personnel_present", "warning_ignored"],
     "regulation": "DGMS Circular (gas testing)", "root_cause": "Electrical hot work in a gassy area without testing."},
    {"title": "Pump house transient + maintenance (near-miss)", "type": "near_miss", "severity": 2,
     "factors": ["personnel_present", "shift_handover"],
     "regulation": "Factory Act 1948 §21", "root_cause": "Maintenance during handover; brief exposure."},
    {"title": "Furnace area CO, PPE lapse (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["toxic_gas", "ppe_missing", "personnel_present", "warning_ignored"],
     "regulation": "Factory Act 1948 §36", "root_cause": "CO monitor not worn; alarm ignored."},
    {"title": "Vessel hot-work, gas test skipped (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["hot_work", "flammable_gas", "confined_space", "no_gas_test", "personnel_present", "permit_conflict"],
     "regulation": "OISD-STD-105", "root_cause": "Multiple controls bypassed under schedule pressure."},
    {"title": "Adjacent-zone ignition during purge (near-miss)", "type": "near_miss", "severity": 3,
     "factors": ["flammable_gas", "adjacent_ignition", "warning_ignored"],
     "regulation": "OISD-STD-105", "root_cause": "Purge gas vented near an active ignition source."},
    {"title": "Night-shift confined entry (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["confined_space", "o2_deficiency", "shift_handover", "no_gas_test", "personnel_present"],
     "regulation": "Factory Act 1948 §36", "root_cause": "Reduced supervision at changeover; entry mis-logged."},
    {"title": "Refinery hot-work, cloud nearby (near-miss)", "type": "near_miss", "severity": 4,
     "factors": ["flammable_gas", "hot_work", "adjacent_ignition", "no_gas_test", "personnel_present"],
     "regulation": "OISD-STD-105", "root_cause": "Hot work proceeded with a flammable plume in the blast radius."},
]


def _prevention(factors: frozenset) -> str:
    f = factors
    if "hot_work" in f and "flammable_gas" in f:
        return ("Block hot-work permit issuance while a flammable trend is rising; require a "
                "gas-free certificate + continuous LEL monitoring for the permit's full duration.")
    if "confined_space" in f and ("o2_deficiency" in f or "toxic_gas" in f):
        return ("Mandatory pre-entry AND continuous atmosphere testing, a dedicated standby "
                "attendant, and a pre-staged rescue plan before any confined-space entry.")
    if "permit_conflict" in f:
        return ("Enforce a cross-permit interlock: incompatible permits (hot-work + confined-space) "
                "cannot be simultaneously active in the same zone or blast radius.")
    if "shift_handover" in f:
        return ("Structured handover checklist with dual sign-off; re-test the atmosphere on permit "
                "re-validation — never carry a previous shift's gas test forward.")
    if "warning_ignored" in f:
        return ("Auto-escalate unacknowledged gas trends and fuse sub-alarm readings with permit + "
                "personnel context so the compound danger is surfaced before any single alarm.")
    if "adjacent_ignition" in f:
        return ("Extend permit checks to the blast radius — evaluate ignition sources in adjacent "
                "zones, not just the work zone.")
    return "Strengthen the permit-to-work approval gate and continuous monitoring for this combination."


def _is_diverse(combo: frozenset, chosen: list[frozenset]) -> bool:
    for c in chosen:
        inter = len(combo & c)
        union = len(combo | c)
        if union and inter / union > 0.6:
            return False
    return True


# personnel exposure is present in virtually every record — it's the stake, not a
# discriminating pattern factor, so it's excluded from combination mining.
_CONTEXT_FACTORS = {"personnel_present"}


def mine_patterns(top: int = 5, min_occurrences: int = 3) -> list[dict]:
    """Find recurring 2-3 factor *hazard* combinations, ranked by frequency x mean
    severity (3-factor patterns get a small edge for being more specific/actionable)."""
    counts: Counter = Counter()
    sev: dict[frozenset, list[int]] = {}
    regs: dict[frozenset, list[str]] = {}
    titles: dict[frozenset, list[str]] = {}
    for rec in CORPUS:
        fs = [f for f in rec["factors"] if f not in _CONTEXT_FACTORS]
        for k in (2, 3):
            for combo in combinations(sorted(fs), k):
                key = frozenset(combo)
                counts[key] += 1
                sev.setdefault(key, []).append(rec["severity"])
                regs.setdefault(key, []).append(rec["regulation"])
                titles.setdefault(key, []).append(rec["title"])

    def score(k: frozenset) -> float:
        mean_sev = sum(sev[k]) / len(sev[k])
        return counts[k] * mean_sev * (1 + 0.18 * (len(k) - 2))  # favour 3-factor patterns

    ranked = sorted(
        (k for k, c in counts.items() if c >= min_occurrences),
        key=lambda k: -score(k),
    )
    out: list[dict] = []
    chosen: list[frozenset] = []
    for key in ranked:
        if not _is_diverse(key, chosen):
            continue
        chosen.append(key)
        mean_sev = round(sum(sev[key]) / len(sev[key]), 1)
        reg = Counter(regs[key]).most_common(1)[0][0]
        out.append({
            "factors": sorted(key),
            "label": " + ".join(FACTOR_LABELS.get(x, x) for x in sorted(key)),
            "occurrences": counts[key],
            "severity": mean_sev,
            "regulation": reg,
            "prevention": _prevention(key),
            "examples": titles[key][:3],
        })
        if len(out) >= top:
            break
    return out


def _briefing(patterns: list[dict], n_incidents: int, n_near: int) -> tuple[str, bool]:
    top = patterns[0] if patterns else None
    if not top:
        return ("No recurring pattern crossed the reporting threshold.", True)
    prompt = (
        f"You are an industrial process-safety analyst. Across {n_incidents} incidents and "
        f"{n_near} near-misses, the most recurring causal combination is: {top['label']} "
        f"(seen {top['occurrences']} times, mean severity {top['severity']}/5). "
        "In 2 sentences, state why this recurring pattern is the top prevention priority and "
        "what single systemic control would break it. Be concrete, no preamble."
    )
    try:
        return generate(prompt, temperature=0.3), False
    except GeminiError:
        return (
            f"The most recurring lethal pattern across the corpus is \"{top['label']}\" "
            f"({top['occurrences']} occurrences, mean severity {top['severity']}/5) — a combination "
            "no single-incident investigation flags as systemic. The highest-leverage control is to "
            f"{top['prevention'][0].lower() + top['prevention'][1:]}",
            True,
        )


def pattern_intelligence() -> dict:
    patterns = mine_patterns()
    n_incidents = sum(1 for r in CORPUS if r["type"] == "incident")
    n_near = sum(1 for r in CORPUS if r["type"] == "near_miss")
    top_factors = Counter(f for r in CORPUS for f in r["factors"]).most_common(6)
    briefing, degraded = _briefing(patterns, n_incidents, n_near)
    return {
        "corpus_size": len(CORPUS),
        "incidents": n_incidents,
        "near_misses": n_near,
        "patterns": patterns,
        "top_factors": [{"factor": FACTOR_LABELS.get(f, f), "count": c} for f, c in top_factors],
        "briefing": briefing,
        "analysis_mode": "cached" if degraded else "live",
    }
