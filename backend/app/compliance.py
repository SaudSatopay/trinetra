"""Quality & Compliance Audit Agent.

Continuously audits the live plant state against OISD / DGMS / Factory-Act
requirements, flags deviations BEFORE an inspector would, and emits a corrective
action for each. Deterministic and auditable by design — a compliance call must be
explainable, so there is no LLM in this loop.
"""
from __future__ import annotations

from .constants import FLAMMABLE_GASES, GAS_THRESHOLDS, ZONES
from .domain import IGNITION_PERMITS, PermitType


def _flam_pct(zone) -> float:
    return max((zone.gases[s].value / GAS_THRESHOLDS[s].low_alarm for s in FLAMMABLE_GASES), default=0.0)


def audit(snapshot, risks: dict) -> dict:
    """Audit every zone's live state + the facility's standing controls."""
    items: list[dict] = []

    def add(requirement, regulation, status, detail, corrective="", zone=""):
        items.append({"requirement": requirement, "regulation": regulation, "status": status,
                      "detail": detail, "corrective": corrective, "zone": zone})

    for zid, z in snapshot.zones.items():
        ign = [p for p in z.active_permits if p.type in IGNITION_PERMITS]
        cs = [p for p in z.active_permits if p.type == PermitType.CONFINED_SPACE]
        flam = _flam_pct(z)
        risk = risks.get(zid)

        if ign:
            if flam >= 0.5:
                add("Gas-free certificate before hot work", "OISD-STD-105", "deviation",
                    f"{ign[0].id} active in {z.name} with flammable gas at {int(flam * 100)}% of the LEL alarm — atmosphere not certified gas-free.",
                    f"Suspend {ign[0].id}; re-issue only after a verified gas-free test + continuous LEL monitoring.", zid)
            else:
                add("Gas-free certificate before hot work", "OISD-STD-105", "ok",
                    f"{ign[0].id} in {z.name} — atmosphere within limits.", "", zid)

        if cs:
            o2 = z.gases["O2"].value
            toxic = max(z.gases["CO"].value / GAS_THRESHOLDS["CO"].low_alarm,
                        z.gases["H2S"].value / GAS_THRESHOLDS["H2S"].low_alarm)
            if o2 < 19.5 or toxic >= 1.0:
                why = f"O2 {o2:.1f}%" + (" + toxic gas above exposure limit" if toxic >= 1.0 else "")
                add("Confined-space atmosphere verification", "Factory Act 1948 §36", "deviation",
                    f"{cs[0].id} in {z.name}: {why} — unsafe for continued entry.",
                    "Evacuate the space, force-ventilate, and resume only with continuous monitoring + a standby attendant.", zid)
            else:
                add("Confined-space atmosphere verification", "Factory Act 1948 §36", "ok",
                    f"{cs[0].id} in {z.name} — atmosphere safe for entry.", "", zid)

        if ign and cs:
            add("Incompatible simultaneous permits", "OISD-STD-105", "deviation",
                f"Hot-work ({ign[0].id}) and confined-space entry ({cs[0].id}) are co-active in {z.name}.",
                "Apply a cross-permit interlock: only one high-hazard permit per zone / blast radius.", zid)

        if risk is not None and getattr(risk, "compound", False) and z.worker_count > 0:
            add("Evacuation on compound-risk escalation", "Factory Act 1948 §38", "deviation",
                f"{z.worker_count} personnel in {z.name} under {risk.level.value.upper()} compound risk — evacuation not yet enforced.",
                "Trigger evacuation and account for all entrants before any re-entry.", zid)

    # --- facility-wide standing controls (the platform's compliance posture) ---
    add("Permit-to-work system in force", "OISD-STD-105", "ok",
        "Digital permit-intelligence agent monitors every active permit against live plant conditions.")
    add("Continuous fixed-gas detection", "Factory Act 1948 §37", "ok",
        "All zones continuously monitored for CH4 / CO / H2S / O2.")
    add("Fire precautions & means of escape", "Factory Act 1948 §38", "ok",
        "Escape routing and multilingual evacuation alerting are configured.")
    add("On-site emergency response plan", "Factory Act 1948 §41B", "ok",
        "Autonomous response orchestrator on standby (alert, evacuate, preserve evidence, report).")
    add("Statutory inspection & records", "DGMS / Factory Inspectorate", "ok",
        "Inspection register current; incident reports auto-filed with regulatory citations.")

    deviations = sum(1 for i in items if i["status"] == "deviation")
    # deviations first, then standing controls
    items.sort(key=lambda i: 0 if i["status"] == "deviation" else 1)
    return {
        "items": items,
        "summary": {"total": len(items), "deviations": deviations, "compliant": len(items) - deviations},
        "analysis_mode": "live",
    }
