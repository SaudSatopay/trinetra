"""Throughput + sustained-load latency — how fast is the engine's sensor-frame -> alert path?

Two measurements, both timed on the real plant (no assertions, no extrapolation tricks):

  1. Sustained load: stream 100k sensor frames (6 zones each) through one engine instance and
     time EVERY frame -> alert decision individually, so the old "noisy micro-benchmark" caveat
     becomes real percentiles — p50 / p90 / p99 / p99.9 / max latency under continuous load.
  2. Tag throughput: the sustained zone-assessment rate, expressed as sensor tags/sec and
     extrapolated to a 10,000-tag plant at 1 Hz.

The engine is O(zones) per frame (each zone assessed independently), single-core, no GPU,
confidence Monte-Carlo off on the hot path (it is display-only).

    python throughput.py
"""
from __future__ import annotations

import time

from app.engine import CompoundRiskEngine
from app.scenarios import SCENARIOS
from app.simulator import PlantSimulator

TAGS_PER_ZONE = 6  # 4 gas species + temperature + pressure
SUSTAIN = 100_000  # frames pushed through under sustained load


def _pct(sorted_us: list[float], q: float) -> float:
    return sorted_us[min(len(sorted_us) - 1, int(len(sorted_us) * q))]


def main():
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], seed=42)
    frames = sim.collect(60)  # 60 real 6-zone snapshots

    eng = CompoundRiskEngine(compute_confidence=False)
    for f in frames:  # warm the per-zone trend history so timings reflect steady state
        eng.assess(f)

    n_frames = len(frames)
    lat_us: list[float] = []
    zone_assessments = 0
    t0 = time.perf_counter()
    for i in range(SUSTAIN):
        s0 = time.perf_counter()
        r = eng.assess(frames[i % n_frames])
        lat_us.append((time.perf_counter() - s0) * 1e6)  # frame -> alert decision, microseconds
        zone_assessments += len(r)
    wall = time.perf_counter() - t0
    lat_us.sort()

    frames_per_sec = SUSTAIN / wall
    zones_per_sec = zone_assessments / wall
    tags_per_sec = zones_per_sec * TAGS_PER_ZONE
    mean_us = sum(lat_us) / len(lat_us)
    zones_10k = 10000 / TAGS_PER_ZONE
    frame_10k_ms = zones_10k / zones_per_sec * 1000

    print("=" * 74)
    print("  TRINETRA THROUGHPUT + LATENCY  -  single-core engine, no GPU, no confidence MC")
    print("=" * 74)
    print(f"  Sustained load : {SUSTAIN:,} frames in {wall:.2f}s  ({frames_per_sec:,.0f} 6-zone frames/sec)")
    print(f"  Frame->alert   : p50 {_pct(lat_us, 0.50):6.1f} us   p90 {_pct(lat_us, 0.90):6.1f} us   "
          f"p99 {_pct(lat_us, 0.99):6.1f} us")
    print(f"                   p99.9 {_pct(lat_us, 0.999):6.1f} us   max {lat_us[-1]:6.1f} us   "
          f"mean {mean_us:5.1f} us")
    print(f"  Throughput     : {zones_per_sec:,.0f} zone-assessments/sec  ->  {tags_per_sec:,.0f} sensor tags/sec")
    print(f"  10k-tag plant  : a ~{zones_10k:,.0f}-zone plant assesses in {frame_10k_ms:.1f} ms per 1 Hz frame")
    print(f"  Headroom       : {1000 / frame_10k_ms:,.0f}x real-time at 1 Hz on one core (O(zones), shardable per plant)")
    print("=" * 74)


if __name__ == "__main__":
    main()
