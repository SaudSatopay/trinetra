"""Scenario library + injector for the Trinetra digital twin.

Each Scenario carries:
  * ground truth (`expected_compound`, `hazard_zone`) so the WP2 benchmark
    can score detection precision/recall and lead time objectively, and
  * a `gas_injection(t)` function returning additive offsets per (zone, signal).

The hero scenario `vizag` reconstructs the conditions of the January 2025
Visakhapatnam coke-oven-battery disaster: a slow flammable-gas build-up that
stays *below* every single-sensor alarm for many minutes, while a hot-work
permit (ignition source) and a confined-space entry (personnel) are active
nearby. Individually: three green lights. Together: a fatal combination.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Tuple

from .domain import Permit, PermitType, Worker

# (zone_id, signal) -> additive offset.  signal is a gas species or the literal "TEMP".
Offsets = Dict[Tuple[str, str], float]


@dataclass
class Scenario:
    name: str
    title: str
    description: str
    expected_compound: bool       # ground truth: genuine compound hazard present?
    hazard_zone: str = ""         # zone where the compound hazard lives (for scoring)
    permits: List[Permit] = field(default_factory=list)
    workers: List[Worker] = field(default_factory=list)
    inject: Callable[[float], Offsets] = lambda t: {}

    def gas_injection(self, t_min: float) -> Offsets:
        return self.inject(t_min)


def ramp(t: float, start: float, peak: float, ramp_min: float, ease: float = 1.5) -> float:
    """Ease-in ramp: 0 before `start`, accelerates to `peak` by start+ramp_min, holds.

    ease > 1 makes it start slow (gas accumulates gently, staying under alarms)
    then accelerate — the dangerous, deceptively-quiet build-up profile.
    """
    if t <= start:
        return 0.0
    frac = min((t - start) / ramp_min, 1.0)
    return peak * (frac ** ease)


# ----------------------------------------------------------------------------
# Scenario definitions
# ----------------------------------------------------------------------------

def _normal_inject(t: float) -> Offsets:
    return {}


NORMAL = Scenario(
    name="normal",
    title="Normal operations",
    description="Routine running. No abnormal release, no high-hazard permits. "
                "Used as the quiet baseline (false-positive control).",
    expected_compound=False,
    inject=_normal_inject,
)


# --- Hero: Vizag-class compound hazard ---------------------------------------
_VIZAG_WORKERS = [
    Worker("W-101", "R. Ramesh", "Fitter"),
    Worker("W-102", "S. Suresh", "Welder"),
    Worker("W-103", "K. Anil", "Confined-space attendant"),
]

_VIZAG_PERMITS = [
    Permit("PTW-7741", PermitType.HOT_WORK, "COB-1", ["W-102"], start_min=0, duration_min=60,
           description="Hot work: welding repair on coke-oven door frame, Battery #1"),
    Permit("PTW-7745", PermitType.CONFINED_SPACE, "COB-1", ["W-101", "W-103"], start_min=5,
           duration_min=55, description="Confined-space entry: sump inspection below Battery #1"),
]


def _vizag_inject(t: float) -> Offsets:
    return {
        ("COB-1", "CH4"): ramp(t, 3, 58, 42),    # crosses 10 %LEL low alarm only ~t13
        ("COB-1", "CO"):  ramp(t, 3, 175, 44),   # crosses 50 ppm alarm only ~t20
        ("COB-1", "H2S"): ramp(t, 4, 24, 46),    # crosses 10 ppm alarm only ~t26
        ("COB-1", "O2"): -ramp(t, 6, 4.5, 40),   # confined-space O2 depletion
        ("COB-1", "TEMP"): ramp(t, 3, 18, 44),
    }


VIZAG_COMPOUND = Scenario(
    name="vizag",
    title="Vizag-class coke-oven compound hazard",
    description="Slow coke-oven-gas accumulation in Battery #1 while a hot-work permit "
                "(ignition) and a confined-space entry (personnel) are active. Each signal "
                "stays below its own alarm for ~13+ minutes. The lethal pattern is the "
                "combination, not any single reading.",
    expected_compound=True,
    hazard_zone="COB-1",
    permits=_VIZAG_PERMITS,
    workers=_VIZAG_WORKERS,
    inject=_vizag_inject,
)


# --- Decoy 1: gas rises, but NO ignition source and NO personnel -------------
def _gas_no_ignition_inject(t: float) -> Offsets:
    return {
        ("GCP", "CH4"): ramp(t, 2, 35, 40),
        ("GCP", "CO"):  ramp(t, 2, 120, 42),
    }


GAS_NO_IGNITION = Scenario(
    name="gas_no_ignition",
    title="Gas release, no ignition source, no personnel",
    description="A genuine gas alarm in the Gas Cleaning Plant — but with no hot-work permit "
                "and nobody in the zone. A single-sensor system alarms; a compound system should "
                "NOT escalate to a life-safety CRITICAL (no ignition, no exposure).",
    expected_compound=False,
    hazard_zone="GCP",
    inject=_gas_no_ignition_inject,
)


# --- Decoy 2: hot work + personnel, but gases stay clean (false-positive trap) -
_ROUTINE_WORKERS = [Worker("W-220", "M. Iqbal", "Welder"), Worker("W-221", "T. Das", "Helper")]
_ROUTINE_PERMITS = [
    Permit("PTW-8810", PermitType.HOT_WORK, "BF-3", ["W-220"], 0, 50,
           description="Routine hot work, Blast Furnace #3 platform"),
    Permit("PTW-8812", PermitType.MAINTENANCE, "BF-3", ["W-221"], 0, 50,
           description="Routine maintenance, Blast Furnace #3"),
]

HOTWORK_NO_GAS = Scenario(
    name="hotwork_no_gas",
    title="Permitted hot work, normal atmosphere",
    description="Hot work and personnel present, but the atmosphere stays clean. This is "
                "safe, permitted, routine work. A naive 'context' rule would false-alarm here; "
                "a good compound engine must stay quiet.",
    expected_compound=False,
    hazard_zone="BF-3",
    permits=_ROUTINE_PERMITS,
    workers=_ROUTINE_WORKERS,
    inject=_normal_inject,
)


# --- Decoy 3: transient noise spike (must not sustain an alarm) ---------------
def _noise_spike_inject(t: float) -> Offsets:
    # a brief CO transient around t=8..11, then gone
    spike = 70.0 if 8 <= t <= 11 else 0.0
    return {("PMP", "CO"): spike}


NOISE_SPIKE = Scenario(
    name="noise_spike",
    title="Transient sensor spike",
    description="A short-lived CO transient in the Pump House with no permits and no trend. "
                "Tests robustness against momentary spikes (must not raise a sustained alarm).",
    expected_compound=False,
    hazard_zone="PMP",
    inject=_noise_spike_inject,
)


SCENARIOS: dict[str, Scenario] = {
    s.name: s for s in (NORMAL, VIZAG_COMPOUND, GAS_NO_IGNITION, HOTWORK_NO_GAS, NOISE_SPIKE)
}
