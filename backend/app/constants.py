"""Domain constants for the Trinetra plant digital twin.

Gas alarm setpoints follow common Indian heavy-industry practice
(Factory Act 1948 / OISD-STD / typical fixed gas-detector configuration).
They are intentionally explicit and testable: the whole thesis of Trinetra
is that lethal danger is detectable *below* these single-sensor alarms when
context (permits, personnel, proximity) is fused in. The compound-risk
engine (WP2) is evaluated against these very thresholds as the baseline.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class GasThreshold:
    """Single-sensor alarm setpoints for one gas species."""

    species: str
    unit: str
    low_alarm: float       # first warning (TWA-like)
    high_alarm: float      # second-stage / STEL-like
    danger: float          # ~IDLH / immediately dangerous
    flammable: bool        # contributes to fire/explosion risk
    direction: str = "high"  # "high": worse as value rises; "low": worse as it falls (O2)

    def in_alarm(self, value: float) -> bool:
        if self.direction == "high":
            return value >= self.low_alarm
        return value <= self.low_alarm

    def stage(self, value: float) -> str:
        """Return '', 'low', 'high', or 'danger' for a reading."""
        order = (("danger", self.danger), ("high", self.high_alarm), ("low", self.low_alarm))
        if self.direction == "high":
            for name, level in order:
                if value >= level:
                    return name
        else:  # low is worse (oxygen)
            for name, level in order:
                if value <= level:
                    return name
        return ""


# CH4 is expressed as %LEL (100 %LEL == 5% vol == lower explosive limit of methane).
GAS_THRESHOLDS: dict[str, GasThreshold] = {
    "CH4": GasThreshold("CH4", "%LEL", low_alarm=10, high_alarm=20, danger=50, flammable=True),
    "CO":  GasThreshold("CO",  "ppm",  low_alarm=50, high_alarm=100, danger=200, flammable=True),
    "H2S": GasThreshold("H2S", "ppm",  low_alarm=10, high_alarm=15, danger=100, flammable=True),
    "O2":  GasThreshold("O2",  "%vol", low_alarm=19.5, high_alarm=18.0, danger=16.0,
                        flammable=False, direction="low"),
}

FLAMMABLE_GASES: tuple[str, ...] = tuple(s for s, t in GAS_THRESHOLDS.items() if t.flammable)

# Realistic fixed-gas-detector noise, as std dev in each species' own unit.
# O2 sensors are very stable; toxic/LEL sensors wander a little. (Absolute, NOT
# scaled by baseline — otherwise O2 at ~20.9 would be the noisiest channel, which
# is the opposite of reality.)
SENSOR_NOISE: dict[str, float] = {"CH4": 0.35, "CO": 0.8, "H2S": 0.25, "O2": 0.05}
DRIFT_SIGMA: dict[str, float] = {"CH4": 0.15, "CO": 0.40, "H2S": 0.12, "O2": 0.02}
TEMP_NOISE = 0.4        # deg C
PRESSURE_NOISE = 0.05   # kPa


@dataclass(frozen=True)
class ZoneSpec:
    """Static definition of a plant zone (geometry + clean-state baselines)."""

    id: str
    name: str
    kind: str            # coke_oven | gas_cleaning | furnace | confined_space | utility | maintenance
    x: float             # layout coordinate on a 0..100 grid (for the geospatial map)
    y: float
    baseline: dict       # species -> clean-state value
    temp_baseline: float    # deg C
    pressure_baseline: float  # kPa absolute-ish
    neighbours: tuple    # adjacent zone ids — used for proximity / blast-radius reasoning


PLANT_NAME = "Vizag-class Integrated Steel Plant (digital twin)"

# A compact but realistic integrated-steel-plant layout. COB-1 (coke oven battery)
# is the high-hazard heart — coke-oven gas is rich in CO/CH4/H2 with H2S — exactly
# the environment of the Jan-2025 Visakhapatnam coke-oven-battery fatality.
ZONES: dict[str, ZoneSpec] = {
    "COB-1": ZoneSpec(
        "COB-1", "Coke Oven Battery #1", "coke_oven", 22, 32,
        {"CH4": 3.0, "CO": 8.0, "H2S": 2.0, "O2": 20.9}, 48.0, 101.8,
        ("GCP", "CST-2", "MNT"),
    ),
    "GCP": ZoneSpec(
        "GCP", "Gas Cleaning Plant", "gas_cleaning", 40, 28,
        {"CH4": 4.0, "CO": 5.0, "H2S": 3.0, "O2": 20.9}, 41.0, 101.5,
        ("COB-1", "BF-3"),
    ),
    "BF-3": ZoneSpec(
        "BF-3", "Blast Furnace #3", "furnace", 63, 40,
        {"CH4": 1.0, "CO": 6.0, "H2S": 1.0, "O2": 20.9}, 55.0, 101.3,
        ("GCP", "PMP"),
    ),
    "CST-2": ZoneSpec(
        "CST-2", "Coke Sump / Confined Tank 2", "confined_space", 26, 50,
        {"CH4": 1.0, "CO": 2.0, "H2S": 4.0, "O2": 20.6}, 34.0, 101.2,
        ("COB-1", "MNT"),
    ),
    "PMP": ZoneSpec(
        "PMP", "Pump House", "utility", 52, 63,
        {"CH4": 0.5, "CO": 1.0, "H2S": 0.5, "O2": 20.9}, 33.0, 101.1,
        ("BF-3", "MNT"),
    ),
    "MNT": ZoneSpec(
        "MNT", "Maintenance Bay", "maintenance", 37, 48,
        {"CH4": 0.5, "CO": 1.0, "H2S": 0.5, "O2": 20.9}, 30.0, 101.0,
        ("COB-1", "CST-2", "PMP"),
    ),
}
