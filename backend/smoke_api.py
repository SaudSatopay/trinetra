"""Quick in-process smoke test of the Trinetra API (no live server needed)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.server import app

c = TestClient(app)


def main():
    print("health   :", c.get("/api/health").json())
    scs = c.get("/api/scenarios").json()
    print("scenarios:", [s["name"] for s in scs])
    plant = c.get("/api/plant").json()
    print("plant    :", len(plant["zones"]), "zones,", len(plant["thresholds"]), "gas thresholds")

    r = c.get("/api/frames/vizag?minutes=16").json()
    frames = r["frames"]
    print("frames   :", len(frames), "for vizag(16)")
    first = next((f for f in frames if f["summary"]["compound_alert"]), None)
    base = next((f for f in frames if f["summary"]["baseline_alarm"]), None)
    if first:
        print(f"  Trinetra compound_alert first at t={first['t_min']:.0f} "
              f"(top={first['summary']['top_zone']} {first['summary']['top_level']})")
    if base:
        print(f"  single-sensor baseline_alarm first at t={base['t_min']:.0f}")

    with c.websocket_connect("/ws") as wsc:
        got = [wsc.receive_json() for _ in range(3)]
    print("ws       :", len(got), "frames streamed; first type =", got[0].get("type"))
    print("OK")


if __name__ == "__main__":
    main()
