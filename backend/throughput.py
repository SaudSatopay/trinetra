"""Throughput measurement — how many sensor tags can ONE engine instance carry at 1 Hz?

The reference-architecture slide claims ~10,000 tags on a single node. Rather than assert it,
this measures it: time the deterministic engine's per-frame assessment on the real plant and
extrapolate to a 10k-tag plant. The engine is O(zones) per frame (each zone is assessed
independently), no GPU, and confidence Monte-Carlo is off on the hot path (it's display-only).

    python throughput.py
"""
from __future__ import annotations

import time

from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator

TAGS_PER_ZONE = 6  # 4 gas species + temperature + pressure


def main():
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], seed=42)
    frames = sim.collect(60)  # 60 real snapshots, 6 zones each

    eng = CompoundRiskEngine(compute_confidence=False)
    for f in frames[:10]:  # warm the trend history
        eng.assess(f)

    n = 4000
    t0 = time.perf_counter()
    zone_assessments = 0
    for i in range(n):
        zone_assessments += len(eng.assess(frames[i % len(frames)]))
    dt = time.perf_counter() - t0

    per_frame_us = dt / n * 1e6
    zones_per_sec = zone_assessments / dt
    tags_per_sec = zones_per_sec * TAGS_PER_ZONE
    zones_10k = 10000 / TAGS_PER_ZONE
    frame_10k_ms = zones_10k / zones_per_sec * 1000

    print("=" * 72)
    print("  TRINETRA THROUGHPUT  -  single-core engine, no GPU, no confidence MC")
    print("=" * 72)
    print(f"  Measured : {zones_per_sec:,.0f} zone-assessments/sec  ({per_frame_us:,.0f} us / 6-zone frame)")
    print(f"  Tags     : {tags_per_sec:,.0f} sensor tags/sec  (at {TAGS_PER_ZONE} tags/zone)")
    print(f"  10k tags : a ~{zones_10k:,.0f}-zone plant assesses in {frame_10k_ms:.1f} ms per 1 Hz frame")
    print(f"  Headroom : {1000 / frame_10k_ms:,.0f}x real-time at 1 Hz on one core (O(zones), shardable per plant)")
    print("=" * 72)


if __name__ == "__main__":
    main()
