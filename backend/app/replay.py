"""SCADA / permit-feed connector — replay external data through the same engine.

The thesis "real deployment is a connector, not a rewrite" made concrete: parse a
plain SCADA-style CSV (per-minute gas readings + a permit/personnel overlay) into
PlantSnapshots and hand them to the *same* CompoundRiskEngine the digital twin uses.
The engine cannot tell — and does not care — whether a snapshot came from the
simulator or a real historian export.

CSV columns (header row required):
    t_min, zone, CH4, CO, H2S, O2, hot_work, personnel
  * t_min  : integer minute (rows grouped by it)
  * zone   : a plant zone id (COB-1, GCP, BF-3, CST-2, PMP, MNT)
  * gases  : absolute sensor values (any omitted gas falls back to the clean baseline)
  * hot_work : 1/0 — is an ignition (hot-work) permit active in the zone
  * personnel: integer headcount present in the zone
"""
from __future__ import annotations

import csv
import io

from .constants import GAS_THRESHOLDS, ZONES
from .domain import GasReading, Permit, PermitType, PlantSnapshot, ZoneState
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

_TRUE = {"1", "true", "yes", "y", "active", "on"}


def parse_csv(text: str) -> tuple[list[PlantSnapshot], dict]:
    """Parse a SCADA/permit CSV into ordered PlantSnapshots. Raises ValueError on bad input."""
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("empty CSV (no header row)")
    cols = {(c or "").strip() for c in reader.fieldnames}
    if "t_min" not in cols or "zone" not in cols:
        raise ValueError("CSV must include at least 't_min' and 'zone' columns")

    rows_by_t: dict[int, list[dict]] = {}
    bad_zones: set[str] = set()
    n_rows = 0
    for raw in reader:
        row = {(k or "").strip(): (v or "").strip() for k, v in raw.items()}
        try:
            t = int(float(row["t_min"]))
        except (KeyError, ValueError):
            continue
        zid = row.get("zone", "")
        if zid not in ZONES:
            if zid:
                bad_zones.add(zid)
            continue
        rows_by_t.setdefault(t, []).append(row)
        n_rows += 1

    if not rows_by_t:
        raise ValueError("no valid data rows (check 't_min' and known zone ids)")

    snapshots: list[PlantSnapshot] = []
    for t in sorted(rows_by_t):
        zone_row = {r["zone"]: r for r in rows_by_t[t]}
        zones: dict[str, ZoneState] = {}
        for zid, spec in ZONES.items():
            r = zone_row.get(zid)
            gases = {}
            for sp, thr in GAS_THRESHOLDS.items():
                val = spec.baseline.get(sp, 0.0)
                if r and r.get(sp):
                    try:
                        val = float(r[sp])
                    except ValueError:
                        pass
                gases[sp] = GasReading(sp, round(val, 2), thr.unit)

            permits, worker_ids = [], []
            if r:
                if r.get("hot_work", "").lower() in _TRUE:
                    permits.append(Permit(f"CSV-HW-{zid}", PermitType.HOT_WORK, zid, [], t, 1,
                                          "ingested hot-work permit"))
                try:
                    n = int(float(r.get("personnel", "0") or 0))
                except ValueError:
                    n = 0
                worker_ids = [f"{zid}-P{i + 1}" for i in range(max(0, n))]

            zones[zid] = ZoneState(zid, spec.name, spec.kind, spec.x, spec.y, gases,
                                   spec.temp_baseline, spec.pressure_baseline, worker_ids, permits)

        all_permits = [p for z in zones.values() for p in z.active_permits]
        snapshots.append(PlantSnapshot(t_min=float(t), scenario="ingested",
                                       zones=zones, permits=all_permits, workers=[]))

    meta = {"rows": n_rows, "minutes_ingested": len(snapshots)}
    if bad_zones:
        meta["ignored_zones"] = sorted(bad_zones)
    return snapshots, meta


def sample_csv(minutes: int = 22) -> str:
    """Export the Vizag hero scenario as a SCADA-style CSV — so judges can download a
    realistic feed, inspect it, and re-ingest it through the connector."""
    sim = PlantSimulator(scenario=SCENARIOS["vizag"], dt_min=1.0, seed=42)
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(["t_min", "zone", "CH4", "CO", "H2S", "O2", "hot_work", "personnel"])
    for snap in sim.run(minutes):
        z = snap.zones["COB-1"]
        hot = 1 if any(p.type == PermitType.HOT_WORK for p in z.active_permits) else 0
        w.writerow([int(snap.t_min), "COB-1",
                    z.gases["CH4"].value, z.gases["CO"].value, z.gases["H2S"].value, z.gases["O2"].value,
                    hot, len(z.worker_ids)])
    return out.getvalue()
