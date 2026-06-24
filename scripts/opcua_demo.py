"""Live OPC-UA ingest demo.

A stand-in plant PLC publishes the Vizag coke-oven gas tags over opc.tcp; Trinetra subscribes over the
SAME protocol a real SCADA/DCS exposes, and the compound engine fires the alert sub-second. Proves the
integration is a connector, not a rewrite, on the technical axis (no external broker needed).

    python scripts/opcua_demo.py
"""
import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from app.opcua_bridge import ENDPOINT, run_session  # noqa: E402


async def main() -> None:
    print(f"OPC-UA server up @ {ENDPOINT}")
    print("PLC publishing Vizag / COB-1 tags; Trinetra subscribing + deciding ...\n")
    r = await run_session("vizag", "COB-1", 20)
    for tk in r["ticks"]:
        flag = "   <-- COMPOUND ALERT" if tk["compound"] else ""
        print(f"  T+{tk['t']:>2}  CH4={tk['ch4']:>5} %LEL   score={tk['score']:>5}   "
              f"read->decide {tk['latency_ms']:>5} ms{flag}")
    print(f"\n  protocol = {r['protocol']}   tags = {', '.join(r['tags'])}")
    print(f"  compound alert T+{r['alert_min']}  vs  single-sensor T+{r['single_sensor_min']}  "
          f"(+{r['lead_min']} min earlier)")
    print(f"  read->decide latency over {r['ticks_count']} ticks:  p50 {r['p50_ms']} ms  ·  "
          f"p99 {r['p99_ms']} ms  ·  mean {r['mean_ms']} ms")


if __name__ == "__main__":
    asyncio.run(main())
