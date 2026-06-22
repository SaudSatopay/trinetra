"""Trinetra knowledge graph (networkx, in-memory).

Encodes the *safety knowledge* the compound engine reasons over, as a graph:

    gases ─is_a─> precursors ─contributes_to─> COMPOUND HAZARD <─precedent_of─ incidents
    zones ─adjacent─> zones        (blast-radius proximity)
    zones ─subject_to─> COMPOUND HAZARD
    permit-types ─enables─> precursors

This is a genuine knowledge graph (not a DB dependency) — it powers blast-radius
reachability and is the artifact behind the architecture diagram.
"""
from __future__ import annotations

import networkx as nx

from ..ai.disaster_memory import INCIDENTS
from ..constants import GAS_THRESHOLDS, ZONES
from ..domain import PermitType

HAZARD = "HZ:coke-oven-explosion"

_PRECURSORS = {
    "PC:flammable-rising": "Rising flammable gas (sub-alarm)",
    "PC:ignition": "Ignition source",
    "PC:personnel": "Personnel present",
    "PC:confined-o2": "Confined space / O2 depletion",
}

_PERMIT_ENABLES = {
    PermitType.HOT_WORK: "PC:ignition",
    PermitType.ELECTRICAL: "PC:ignition",
    PermitType.CONFINED_SPACE: "PC:confined-o2",
    PermitType.MAINTENANCE: "PC:personnel",
}

_HAZARD_ZONES = ("COB-1", "CST-2")  # zones whose profile matches the compound hazard


def build_kg() -> nx.DiGraph:
    g = nx.DiGraph()
    g.add_node(HAZARD, type="hazard", label="Coke-oven gas explosion")

    for nid, lbl in _PRECURSORS.items():
        g.add_node(nid, type="precursor", label=lbl)
        g.add_edge(nid, HAZARD, rel="contributes_to")

    for sp, thr in GAS_THRESHOLDS.items():
        g.add_node(f"GAS:{sp}", type="gas", label=sp, flammable=thr.flammable)
        if thr.flammable:
            g.add_edge(f"GAS:{sp}", "PC:flammable-rising", rel="is_a")
        elif sp == "O2":
            g.add_edge(f"GAS:{sp}", "PC:confined-o2", rel="is_a")

    for pt, pc in _PERMIT_ENABLES.items():
        nid = f"PT:{pt.value}"
        g.add_node(nid, type="permit", label=pt.value)
        g.add_edge(nid, pc, rel="enables")

    for zid, spec in ZONES.items():
        g.add_node(f"ZN:{zid}", type="zone", label=spec.name, kind=spec.kind)
    for zid, spec in ZONES.items():
        for n in spec.neighbours:
            if n in ZONES:
                g.add_edge(f"ZN:{zid}", f"ZN:{n}", rel="adjacent")
    for zid in _HAZARD_ZONES:
        g.add_edge(f"ZN:{zid}", HAZARD, rel="subject_to")

    for inc in INCIDENTS:
        nid = f"IN:{inc['id']}"
        g.add_node(nid, type="incident", label=inc["title"], date=inc["date"])
        g.add_edge(nid, HAZARD, rel="precedent_of")

    return g


def kg_export() -> dict:
    g = build_kg()
    nodes = [{"id": n, **g.nodes[n]} for n in g.nodes]
    edges = [{"source": u, "target": v, "rel": d["rel"]} for u, v, d in g.edges(data=True)]
    return {"nodes": nodes, "edges": edges,
            "stats": {"nodes": g.number_of_nodes(), "edges": g.number_of_edges()}}


def blast_radius(zone_id: str, hops: int = 1) -> list[str]:
    """Zones reachable from `zone_id` within `hops` adjacency edges (blast-radius set)."""
    g = build_kg()
    src = f"ZN:{zone_id}"
    if src not in g:
        return []
    reach: set[str] = set()
    frontier = {src}
    for _ in range(max(1, hops)):
        nxt = {v for z in frontier for _, v, d in g.out_edges(z, data=True) if d.get("rel") == "adjacent"}
        reach |= nxt
        frontier = nxt
    return sorted(z.replace("ZN:", "") for z in reach)
