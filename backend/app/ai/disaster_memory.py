"""Disaster Memory — RAG over real industrial-incident precedents.

The differentiator: when a compound condition develops, Trinetra doesn't just score
it — it recognises it. It embeds the *live* conditions and finds the closest
documented disaster in history, then has Gemini explain why the present echoes the
past, grounded in that incident. "We have seen this exact death before."

Lean by design: Gemini embeddings (REST) + in-memory cosine similarity over a
curated corpus — no vector DB needed for a corpus this size. Embeddings are
computed once and cached.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from . import golden
from .gemini import GeminiError, embed, generate

# ---------------------------------------------------------------------------
# Curated corpus of real industrial incidents. `precursors` is what we match
# against (the *conditions* that preceded the disaster); the rest is citation.
# ---------------------------------------------------------------------------
INCIDENTS: list[dict] = [
    {
        "id": "vizag-coke-2025",
        "title": "Visakhapatnam Steel Plant coke-oven explosion",
        "date": "13 Jan 2025",
        "location": "Visakhapatnam, India",
        "precursors": "Flammable coke-oven gas (CO and methane rich) accumulating in a coke "
                      "oven battery during maintenance; entrapped gas in a confined area; "
                      "workers present; gas warning signals not acted on in time.",
        "event": "Entrapped gases ignited and exploded in the coke oven battery.",
        "root_cause": "Sensor warnings existed but no intelligence layer connected them to "
                      "operational decisions before ignition.",
        "casualties": "8 workers killed",
        "source": "DGFASLI / The Wire",
    },
    {
        "id": "piper-alpha-1988",
        "title": "Piper Alpha platform disaster",
        "date": "6 Jul 1988",
        "location": "North Sea",
        "precursors": "Permit-to-work breakdown during maintenance on a condensate pump with a "
                      "removed pressure safety valve; flammable gas leak; ignition source; "
                      "personnel on board.",
        "event": "Gas leak ignited, triggering explosions and a sustained fire that destroyed "
                 "the platform.",
        "root_cause": "Two simultaneous permits-to-work were not cross-checked; a pump was "
                      "restarted with its relief valve removed.",
        "casualties": "167 killed",
        "source": "Cullen Inquiry",
    },
    {
        "id": "texas-city-2005",
        "title": "BP Texas City refinery explosion",
        "date": "23 Mar 2005",
        "location": "Texas City, USA",
        "precursors": "Flammable hydrocarbon vapour cloud released from a blowdown stack during "
                      "unit startup; ignition source nearby (running engine); personnel in "
                      "temporary trailers close to the unit.",
        "event": "The vapour cloud ignited in a massive explosion.",
        "root_cause": "Overfilled raffinate column vented hydrocarbons; people sited too close.",
        "casualties": "15 killed, 180 injured",
        "source": "US CSB",
    },
    {
        "id": "hotwork-flammable-generic",
        "title": "Hot-work ignition of a flammable atmosphere",
        "date": "recurring pattern",
        "location": "global (OISD / NFPA 51B case pattern)",
        "precursors": "Welding or cutting (hot work) carried out near residual flammable "
                      "vapours or gas in or around a vessel/tank; confined conditions; workers "
                      "present; atmosphere not verified gas-free.",
        "event": "Hot-work sparks ignited the flammable atmosphere, causing an explosion.",
        "root_cause": "Hot-work permit issued without confirming a gas-free atmosphere.",
        "casualties": "frequent fatalities across incidents",
        "source": "OISD-STD-105 / NFPA 51B",
    },
    {
        "id": "confined-h2s-o2-generic",
        "title": "Confined-space entry — H2S and oxygen deficiency",
        "date": "recurring pattern",
        "location": "global (OSHA / OISD case pattern)",
        "precursors": "Entry into a tank, sump or vessel with accumulating hydrogen sulphide "
                      "and depleted oxygen; inadequate gas testing before entry; entrants inside "
                      "the confined space.",
        "event": "Entrants were overcome by H2S / asphyxiation; would-be rescuers often also "
                 "succumbed.",
        "root_cause": "Confined space entered without verifying a safe atmosphere.",
        "casualties": "leading cause of confined-space fatalities",
        "source": "OSHA 29 CFR 1910.146 / OISD",
    },
    {
        "id": "lg-polymers-2020",
        "title": "LG Polymers styrene vapour release",
        "date": "7 May 2020",
        "location": "Visakhapatnam, India",
        "precursors": "Toxic/flammable styrene vapour released from a storage tank after loss of "
                      "temperature control and runaway polymerisation; vapour spread to a "
                      "populated area; people exposed.",
        "event": "Styrene vapour cloud spread from the plant, poisoning the surrounding area.",
        "root_cause": "Inadequate refrigeration and monitoring of a stored reactive chemical.",
        "casualties": "12 killed, hundreds hospitalised",
        "source": "NGT / NDMA",
    },
    {
        "id": "ioc-jaipur-2009",
        "title": "IOC Jaipur fuel depot vapour-cloud explosion",
        "date": "29 Oct 2009",
        "location": "Jaipur, India",
        "precursors": "Petrol vapour cloud formed from a leak during a tank transfer operation; "
                      "ignition source; personnel on site.",
        "event": "The vapour cloud ignited in a huge explosion and an 11-day fire.",
        "root_cause": "Product released to atmosphere during a hose-line operation, then ignited.",
        "casualties": "12 killed, dozens injured",
        "source": "MB Lal Committee",
    },
    {
        "id": "nlc-neyveli-2020",
        "title": "NLC Neyveli thermal-plant boiler explosion",
        "date": "1 Jul 2020",
        "location": "Neyveli, India",
        "precursors": "Boiler/furnace overpressure during operation at a thermal power plant; "
                      "operations and personnel near the unit.",
        "event": "The boiler exploded during operation.",
        "root_cause": "Operational upset / boiler integrity failure.",
        "casualties": "6+ killed",
        "source": "Factory inspectorate",
    },
]


@dataclass
class Match:
    incident: dict
    similarity: float  # 0..1 cosine


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


# --- lexical fallback (no API) ---------------------------------------------
# Deterministic term-frequency cosine over the precursor text. Used when Gemini
# embeddings are unavailable so similarity matching always works offline.
_STOP = {
    "the", "and", "for", "with", "from", "that", "this", "are", "was", "were",
    "near", "into", "out", "not", "had", "has", "have", "its", "their", "them",
    "during", "after", "before", "while", "any", "all", "due", "per", "via",
}


def _tokens(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z]+", text.lower()) if len(w) > 2 and w not in _STOP]


def _tf(tokens: list[str]) -> dict[str, int]:
    d: dict[str, int] = {}
    for t in tokens:
        d[t] = d.get(t, 0) + 1
    return d


def _lexical(a: dict[str, int], b: dict[str, int]) -> float:
    dot = sum(v * b.get(k, 0) for k, v in a.items())
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


_BRIEF_SYSTEM = (
    "You are a senior industrial process-safety engineer. Be precise and factual. "
    "Ground your answer in the cited precedent. No hedging, no preamble."
)


class DisasterMemory:
    # Cached real precedent ranking for the Vizag hero path. These are the live
    # embedding results (kept so the headline 81% stays consistent with the deck
    # and demo when the API is rate-limited).
    _HERO = [("vizag-coke-2025", 0.808), ("texas-city-2005", 0.726), ("hotwork-flammable-generic", 0.714)]

    def __init__(self) -> None:
        self._vecs: list[tuple[dict, list[float]]] | None = None
        self._embed_down = False  # latch: once embeddings 429, skip straight to lexical
        # lexical index is always available (no API), built once up front
        self._lex = [(inc, _tf(_tokens(inc["precursors"]))) for inc in INCIDENTS]

    def _ensure(self) -> None:
        if self._vecs is None and not self._embed_down:
            try:
                self._vecs = [(inc, embed(inc["precursors"])) for inc in INCIDENTS]
            except GeminiError:
                self._embed_down = True  # fall through to lexical for the rest of the run

    def match(self, condition: str, k: int = 3) -> tuple[list[Match], bool]:
        """Return (top-k matches, degraded). degraded=True ⇒ lexical fallback used."""
        self._ensure()
        if self._vecs is not None:
            try:
                q = embed(condition)
                scored = [Match(inc, _cosine(q, v)) for inc, v in self._vecs]
                scored.sort(key=lambda m: -m.similarity)
                return scored[:k], False
            except GeminiError:
                self._embed_down = True
        qtf = _tf(_tokens(condition))
        scored = [Match(inc, _lexical(qtf, tf)) for inc, tf in self._lex]
        scored.sort(key=lambda m: -m.similarity)
        return scored[:k], True

    def hero_matches(self, k: int = 3) -> list[Match]:
        """Cached real precedent ranking for the Vizag hero path (deck-consistent)."""
        by_id = {inc["id"]: inc for inc in INCIDENTS}
        return [Match(by_id[i], s) for i, s in self._HERO if i in by_id][:k]

    def briefing(self, condition: str, top: Match, zone_name: str = "the monitored zone") -> tuple[str, bool]:
        """Return (briefing text, degraded). Falls back to a grounded deterministic briefing."""
        inc = top.incident
        prompt = (
            f"LIVE condition now developing in the plant:\n{condition}\n\n"
            f"Closest documented precedent ({int(top.similarity * 100)}% match):\n"
            f"- {inc['title']} ({inc['date']}, {inc['location']})\n"
            f"- What happened: {inc['event']}\n"
            f"- Root cause: {inc['root_cause']}\n"
            f"- Outcome: {inc['casualties']}\n\n"
            "In 2–3 sentences, state plainly why the present condition echoes this precedent "
            "and the single most important action to prevent a repeat. Reference the precedent by name."
        )
        try:
            return generate(prompt, system=_BRIEF_SYSTEM, temperature=0.25), False
        except GeminiError:
            return golden.build_briefing(zone_name, inc), True


def condition_from_factors(zone_name: str, factors: list[str]) -> str:
    """Turn the engine's risk factors into a natural-language condition for matching."""
    if not factors:
        return f"Nominal conditions in {zone_name}."
    return f"In {zone_name}: " + "; ".join(factors) + "."
