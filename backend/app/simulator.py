"""PlantSimulator — the Trinetra digital twin.

Deterministic, seedable, dependency-free. Each `step()` advances the clock by
`dt_min` and returns a PlantSnapshot whose sensor values are:

    baseline + bounded slow drift + Gaussian noise + scenario injection

Determinism (fixed seed) matters: backtests and the WP2 benchmark must be
reproducible so the evaluation numbers are explicit and testable.
"""
from __future__ import annotations

import random
from typing import Iterator, List, Optional

from .constants import (
    DRIFT_SIGMA, GAS_THRESHOLDS, PLANT_NAME, PRESSURE_NOISE, SENSOR_NOISE, TEMP_NOISE, ZONES,
)
from .domain import GasReading, PlantSnapshot, Worker, ZoneState
from .scenarios import NORMAL, Scenario


class PlantSimulator:
    def __init__(self, scenario: Optional[Scenario] = None, dt_min: float = 1.0, seed: int = 42):
        self.scenario: Scenario = scenario or NORMAL
        self.dt_min = dt_min
        self.seed = seed
        self.plant_name = PLANT_NAME
        self.reset()

    def reset(self) -> None:
        self.t_min = 0.0
        self.rng = random.Random(self.seed)
        # bounded mean-reverting drift state per (zone, species)
        self._drift = {zid: {sp: 0.0 for sp in GAS_THRESHOLDS} for zid in ZONES}

    # -- helpers --------------------------------------------------------------
    def _noise(self, scale: float) -> float:
        return self.rng.gauss(0.0, scale)

    def _evolve_drift(self, zid: str, sp: str) -> float:
        d = self._drift[zid][sp] * 0.9 + self._noise(DRIFT_SIGMA[sp])  # AR(1): slow, tight wander
        self._drift[zid][sp] = d
        return d

    # -- main loop ------------------------------------------------------------
    def step(self) -> PlantSnapshot:
        t = self.t_min
        injections = self.scenario.gas_injection(t)
        active_permits = [p for p in self.scenario.permits if p.active_at(t)]

        zones: dict[str, ZoneState] = {}
        for zid, spec in ZONES.items():
            gases: dict[str, GasReading] = {}
            for sp, thr in GAS_THRESHOLDS.items():
                base = spec.baseline.get(sp, 0.0)
                drift = self._evolve_drift(zid, sp)
                noise = self._noise(SENSOR_NOISE[sp])
                inj = injections.get((zid, sp), 0.0)
                val = base + drift + noise + inj
                if sp == "O2":
                    val = min(val, 20.9)        # cannot exceed ambient; injection only depletes
                else:
                    val = max(val, 0.0)
                gases[sp] = GasReading(sp, round(val, 2), thr.unit)

            zone_permits = [p for p in active_permits if p.zone_id == zid]
            worker_ids: list[str] = []
            for p in zone_permits:
                for wid in p.worker_ids:
                    if wid not in worker_ids:
                        worker_ids.append(wid)

            temp = spec.temp_baseline + self._noise(TEMP_NOISE) + injections.get((zid, "TEMP"), 0.0)
            press = spec.pressure_baseline + self._noise(PRESSURE_NOISE)

            zones[zid] = ZoneState(
                zone_id=zid, name=spec.name, kind=spec.kind, x=spec.x, y=spec.y,
                gases=gases, temperature=round(temp, 1), pressure=round(press, 2),
                worker_ids=worker_ids, active_permits=zone_permits,
            )

        snapshot = PlantSnapshot(
            t_min=t, scenario=self.scenario.name, zones=zones,
            permits=active_permits, workers=list(self.scenario.workers),
        )
        self.t_min += self.dt_min
        return snapshot

    def run(self, minutes: float) -> Iterator[PlantSnapshot]:
        """Yield one snapshot per timestep for `minutes` of simulated time."""
        steps = int(round(minutes / self.dt_min))
        for _ in range(steps):
            yield self.step()

    def collect(self, minutes: float) -> List[PlantSnapshot]:
        return list(self.run(minutes))
