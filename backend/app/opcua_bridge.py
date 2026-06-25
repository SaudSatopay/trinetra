"""Live OPC-UA ingest — the real industrial integration surface.

SCADA / DCS / PLC systems speak **OPC-UA**, not CSV. This bridge stands up an in-process OPC-UA server
(a stand-in plant PLC / historian), publishes one zone's live gas + permit + personnel tags onto it,
and an OPC-UA client reads them back **over the wire** and feeds each update straight into the SAME
`CompoundRiskEngine`. It proves Trinetra ingests over the protocol a real plant actually exposes —
sub-second, live — not just a recorded file. Self-contained: the server runs in this process, no
external broker. `asyncua` is an optional dependency (lazy-imported here)."""
from __future__ import annotations

import time

from .constants import GAS_THRESHOLDS
from .domain import PermitType
from .engine import CompoundRiskEngine
from .scenarios import SCENARIOS
from .simulator import PlantSimulator

ENDPOINT = "opc.tcp://127.0.0.1:4840/trinetra/"
TAGS = ("CH4", "CO", "H2S", "O2")


async def run_session(scenario: str = "vizag", zone: str = "COB-1", minutes: int = 20) -> dict:
    """Stream a scenario's tags through a live OPC-UA server -> client round-trip into the engine.
    Returns the per-tick tape, the compound-alert minute vs the single-sensor minute, and the
    read->decide latency percentiles (p50/p99). The engine scores the gas tags read back over the
    wire (this zone's readings are rebuilt from the client reads, not the in-memory snapshot they
    were published from); permits + personnel come from the permit-to-work system, published
    alongside as OPC-UA tags."""
    from asyncua import Client, Server  # lazy: optional dep

    sim = PlantSimulator(scenario=SCENARIOS[scenario], dt_min=1.0, seed=42)
    snaps = list(sim.run(minutes))

    server = Server()
    await server.init()
    server.set_endpoint(ENDPOINT)
    server.set_server_name("Trinetra Plant OPC-UA (demo PLC)")
    idx = await server.register_namespace("http://trinetra.plant/opcua")
    zobj = await server.nodes.objects.add_object(idx, zone)
    svars = {}
    for sp in TAGS:
        svars[sp] = await zobj.add_variable(idx, sp, 0.0)
        await svars[sp].set_writable()
    s_hot = await zobj.add_variable(idx, "hot_work", False)
    await s_hot.set_writable()
    s_crew = await zobj.add_variable(idx, "personnel", 0)
    await s_crew.set_writable()

    engine = CompoundRiskEngine(compute_confidence=False)
    tape: list[dict] = []
    lat: list[float] = []
    alert_min = single_min = None

    async with server:
        async with Client(ENDPOINT) as client:
            cvars = {sp: await client.nodes.objects.get_child([f"{idx}:{zone}", f"{idx}:{sp}"]) for sp in TAGS}
            c_hot = await client.nodes.objects.get_child([f"{idx}:{zone}", f"{idx}:hot_work"])
            c_crew = await client.nodes.objects.get_child([f"{idx}:{zone}", f"{idx}:personnel"])
            for snap in snaps:
                z = snap.zones[zone]
                # the "PLC" publishes the live tag values onto the OPC-UA server
                for sp in TAGS:
                    await svars[sp].write_value(float(z.gases[sp].value))
                await s_hot.write_value(any(p.type == PermitType.HOT_WORK for p in z.active_permits))
                await s_crew.write_value(int(z.worker_count))
                # Trinetra reads them back over OPC-UA and the engine scores THOSE values — time the
                # read->decide path. Rebuild this zone's gas readings from the wire reads so the engine
                # genuinely consumes the OPC-UA data, not the in-memory snapshot it was published from.
                t0 = time.perf_counter()
                vals = {sp: await cvars[sp].read_value() for sp in TAGS}
                await c_hot.read_value()
                await c_crew.read_value()
                for sp in TAGS:
                    z.gases[sp].value = float(vals[sp])
                zr = engine.assess(snap)[zone]
                lat.append((time.perf_counter() - t0) * 1000.0)
                comp = bool(zr.compound and zr.score >= 40)
                if comp and alert_min is None:
                    alert_min = int(snap.t_min)
                if single_min is None and any(GAS_THRESHOLDS[sp].in_alarm(vals[sp]) for sp in TAGS):
                    single_min = int(snap.t_min)
                tape.append({"t": int(snap.t_min), "ch4": round(vals["CH4"], 1), "compound": comp,
                             "score": round(zr.score, 1), "latency_ms": round(lat[-1], 2)})

    lat.sort()
    pct = (lambda q: round(lat[min(len(lat) - 1, int(len(lat) * q))], 2)) if lat else (lambda q: None)
    return {
        "protocol": "OPC-UA", "endpoint": ENDPOINT, "scenario": scenario, "zone": zone,
        "tags": [*TAGS, "hot_work", "personnel"], "ticks": tape, "ticks_count": len(tape),
        "alert_min": alert_min, "single_sensor_min": single_min,
        "lead_min": (single_min - alert_min) if (alert_min is not None and single_min is not None) else None,
        "p50_ms": pct(0.50), "p99_ms": pct(0.99),
        "mean_ms": round(sum(lat) / len(lat), 2) if lat else None,
    }
