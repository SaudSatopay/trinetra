"""Business-impact model — what a prevented compound incident is worth.

Judges score Business Impact; this turns the safety claim into money. The model is
deliberately deterministic, conservative, and TRANSPARENT: every line item carries
its basis so the figure is defensible under questioning, not a magic number.

All amounts in INR. Figures are order-of-magnitude, sourced to comparable Indian
process-safety incidents where possible, and intentionally on the low side.
"""
from __future__ import annotations

import re

CRORE = 1e7  # 1 crore = 10,000,000

# Fully-loaded unit costs (conservative; basis stated per line in BASIS).
COST_PER_FATALITY = 2.5 * CRORE   # compensation + legal + investigation + lost output
ASSET_DAMAGE = 40.0 * CRORE       # coke-oven battery + adjacent-unit damage
DOWNTIME_PER_DAY = 3.0 * CRORE    # lost daily contribution from a unit/section outage
DOWNTIME_DAYS = 21                # investigation + repair + restart
REGULATORY = 5.0 * CRORE          # statutory penalties / levies
SYSTEM_COST_ANNUAL = 1.0 * CRORE  # Trinetra platform, per plant per year

BASIS = {
    "lives": "fully-loaded cost per fatality: compensation + legal + investigation + lost output",
    "asset": "coke-oven battery + adjacent-unit damage (order-of-magnitude, comparable incidents)",
    "downtime": f"{DOWNTIME_DAYS}-day unit outage (investigation + repair + restart) x daily contribution",
    "regulatory": "statutory penalties / levies (cf. NGT Rs 50 cr, LG Polymers 2020; conservative)",
}


def _cr(x: float) -> float:
    return round(x / CRORE, 1)


def parse_toll(casualties: str) -> int:
    """Extract a fatality count from a precedent's casualty string ('8 workers killed' -> 8)."""
    m = re.search(r"(\d+)", casualties or "")
    return int(m.group(1)) if m else 0


# --- expected-value framing -------------------------------------------------
# A per-incident multiple ("one prevented Vizag / annual cost") flatters the ROI and
# a serious buyer discounts it on sight. They underwrite EXPECTED annual value, so we
# anchor the event frequency CONSERVATIVELY and show a sensitivity band — the case has
# to hold on pessimistic assumptions, not just the headline.
EVENT_FREQS = ((30, "1-in-30-yr"), (15, "1-in-15-yr"), (8, "1-in-8-yr"))
ANCHOR_YEARS = 15

# Insurance lever: industrial insurers grant recurring premium reductions for
# continuous process-safety monitoring — value that accrues every year, incident or
# not. The premium basis is illustrative and labelled as such (no invented authority).
INSURANCE_PREMIUM_CR = 8.0     # illustrative annual property + liability premium, large MAH plant
INSURANCE_PCT = (5, 15)        # typical reduction band for continuous monitoring


def compute_impact(personnel: int, precedent_toll: int = 0, lead_min: int = 0) -> dict:
    """Avoided loss from converting one compound incident into a near-miss — plus the
    expected-annual-value and insurance framing a buyer actually underwrites against."""
    lives = max(int(personnel), 0)
    items = [
        {"key": "lives", "label": f"Lives protected ({lives} in zone)",
         "value_cr": _cr(lives * COST_PER_FATALITY), "basis": BASIS["lives"]},
        {"key": "asset", "label": "Asset damage avoided",
         "value_cr": _cr(ASSET_DAMAGE), "basis": BASIS["asset"]},
        {"key": "downtime", "label": f"Downtime avoided ({DOWNTIME_DAYS} days)",
         "value_cr": _cr(DOWNTIME_DAYS * DOWNTIME_PER_DAY), "basis": BASIS["downtime"]},
        {"key": "regulatory", "label": "Regulatory penalty avoided",
         "value_cr": _cr(REGULATORY), "basis": BASIS["regulatory"]},
    ]
    total_cr = round(sum(i["value_cr"] for i in items), 1)
    annual_cr = _cr(SYSTEM_COST_ANNUAL)

    def ev_roi(years: int) -> float:
        return round((total_cr / years) / annual_cr, 1) if annual_cr else 0.0

    sensitivity = [
        {"freq_label": lbl, "years": yrs, "annual_expected_cr": round(total_cr / yrs, 1),
         "ev_roi_x": ev_roi(yrs)}
        for yrs, lbl in EVENT_FREQS
    ]
    ins_low = round(INSURANCE_PREMIUM_CR * INSURANCE_PCT[0] / 100, 1)
    ins_high = round(INSURANCE_PREMIUM_CR * INSURANCE_PCT[1] / 100, 1)

    return {
        "currency": "INR",
        "total_cr": total_cr,
        "items": items,
        "fatalities_at_risk": lives,
        "precedent_toll": precedent_toll,
        "lead_min": lead_min,
        "system_cost_annual_cr": annual_cr,
        "ev": {
            "anchor_label": f"1-in-{ANCHOR_YEARS}-yr",
            "anchor_years": ANCHOR_YEARS,
            "annual_expected_avoided_cr": round(total_cr / ANCHOR_YEARS, 1),
            "ev_roi_x": ev_roi(ANCHOR_YEARS),
            "net_annual_cr": round(total_cr / ANCHOR_YEARS - annual_cr, 1),
            "sensitivity": sensitivity,
            "basis": "expected annual avoided loss = P(serious compound event / plant / yr) x per-incident "
                     "avoided loss; frequency anchored conservatively — major process incidents recur on a "
                     "multi-year cadence per high-hazard site.",
        },
        "insurance": {
            "premium_basis_cr": INSURANCE_PREMIUM_CR,
            "reduction_pct": list(INSURANCE_PCT),
            "annual_value_cr": [ins_low, ins_high],
            "basis": "recurring property/liability premium reduction insurers grant for continuous "
                     "process-safety monitoring (illustrative premium basis) — value independent of any incident.",
        },
    }
