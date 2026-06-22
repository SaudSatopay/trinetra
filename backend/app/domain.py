"""Core domain models for the Trinetra digital twin.

Plain dataclasses + enums so the simulator runs with the standard library
only (no install required to demo WP1). Pydantic schemas for the API layer
arrive with WP3.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class PermitType(str, Enum):
    HOT_WORK = "hot_work"
    CONFINED_SPACE = "confined_space_entry"
    MAINTENANCE = "maintenance"
    WORKING_AT_HEIGHT = "working_at_height"
    ELECTRICAL = "electrical_isolation"


# Permit types that introduce an ignition source — decisive for flammable-gas
# compound risk (a hot-work permit beside rising CH4 is the Vizag pattern).
IGNITION_PERMITS = frozenset({PermitType.HOT_WORK, PermitType.ELECTRICAL})

# Permit types that place personnel in harm's way inside a zone.
OCCUPANCY_PERMITS = frozenset(
    {PermitType.CONFINED_SPACE, PermitType.MAINTENANCE, PermitType.HOT_WORK,
     PermitType.WORKING_AT_HEIGHT}
)


class RiskLevel(str, Enum):
    NORMAL = "normal"
    WATCH = "watch"
    ELEVATED = "elevated"
    HIGH = "high"
    CRITICAL = "critical"

    @property
    def rank(self) -> int:
        return list(RiskLevel).index(self)


@dataclass
class GasReading:
    species: str
    value: float
    unit: str


@dataclass
class Permit:
    """A permit-to-work, valid for [start_min, start_min + duration_min]."""

    id: str
    type: PermitType
    zone_id: str
    worker_ids: list  # list[str]
    start_min: float
    duration_min: float
    description: str = ""

    def active_at(self, t_min: float) -> bool:
        return self.start_min <= t_min <= self.start_min + self.duration_min


@dataclass
class Worker:
    id: str
    name: str
    role: str
    ppe_ok: bool = True


@dataclass
class ZoneState:
    """A zone's full state at one timestep."""

    zone_id: str
    name: str
    kind: str
    x: float
    y: float
    gases: dict          # species -> GasReading
    temperature: float
    pressure: float
    worker_ids: list     # workers present in this zone right now
    active_permits: list  # Permit objects active in this zone right now

    @property
    def worker_count(self) -> int:
        return len(self.worker_ids)

    def permit_types(self) -> set:
        return {p.type for p in self.active_permits}


@dataclass
class PlantSnapshot:
    """The whole plant at one timestep — the unit the engine/dashboard consume."""

    t_min: float
    scenario: str
    zones: dict          # zone_id -> ZoneState
    permits: list        # all permits active plant-wide
    workers: list        # Worker registry (names/roles)

    def zone(self, zone_id: str) -> ZoneState:
        return self.zones[zone_id]
