# 🛡️ Trinetra — Industrial Safety Intelligence for Zero-Harm Operations

> **The third eye that sees the danger no single sensor can.**

**ET AI Hackathon 2.0 — Problem Statement #1 (Industrial Safety Intelligence / Worker Safety / Geospatial Safety Analytics).**

---

## The problem

On **13 January 2025, eight workers died** in a coke-oven-battery explosion at the **Visakhapatnam Steel Plant**. The gas sensors had data. The permits were logged. SCADA was running. **No layer connected those signals in time.** India records **over 6,500 fatal workplace accidents a year** (DGFASLI, FY2023). The bottleneck is not missing sensors — it is the missing *intelligence layer* that turns scattered readings into a decision before a fatality, not after.

## The thesis — compound risk

Fatalities are rarely caused by one sensor screaming. They are caused by a **combination** of conditions that each look normal on their own:

```
   rising (but sub-alarm) flammable gas
 + an active hot-work permit  (ignition source)
 + personnel inside a confined space
 ─────────────────────────────────────────────
 = a lethal combination that NO single sensor flags
```

**Three green lights. One lethal combination.** Trinetra fuses IoT gas sensors, permit-to-work logs, CCTV and shift records into one real-time brain that detects these **compound** conditions — and acts — *before* the alarm.

## Architecture

```
DATA (Digital Twin)        INTELLIGENCE (LangGraph multi-agent)        PRESENTATION
─────────────────          ───────────────────────────────────        ─────────────
gas/temp/pressure  ─┐      Sensor · Permit · Vision · RAG agents       Next.js control room
permits-to-work    ─┤──►   ──────────────┬──────────────────          • geospatial heatmap
CCTV (YOLOv8)      ─┤      Compound-Risk Reasoner (rules + LLM)  ──►   • compound-risk cards
OISD/FactoryAct RAG─┘      Emergency Response Orchestrator              • scenario replay
                                                                       • auto incident report
```

A **hybrid** engine: a transparent **deterministic scoring backbone makes the safety decision** (no hallucination), while the **LLM explains, cites regulations, and drafts incident reports**. Industry judges trust this; pure-LLM safety calls they do not.

## Multi-modal by design

| Modality | Source | Status |
|---|---|---|
| IoT / SCADA telemetry | gas (CH4/CO/H2S/O2), temp, pressure | ✅ WP1 |
| Permit-to-work intelligence | hot-work, confined-space, maintenance | ✅ WP1 |
| Computer vision | CCTV → worker / PPE / zone-intrusion (YOLOv8) | ⏳ WP4 |
| Retrieval (RAG) | OISD / Factory Act / DGMS + incident history (Gemini + ChromaDB) | ⏳ WP4 |
| Agentic reasoning | LangGraph multi-agent orchestration | ⏳ WP4 |

## Repo layout

```
trinetra/
  backend/
    app/
      constants.py     # gas thresholds + plant zone layout
      domain.py        # dataclasses + enums (permits, zones, snapshots)
      simulator.py     # PlantSimulator — the digital twin
      scenarios.py     # scenario library + injector (incl. hero "vizag")
    run_sim.py         # WP1 demo runner
    requirements.txt
  frontend/            # Next.js control room (WP3)
  data/corpus/         # OISD / Factory Act / incident docs for RAG (WP4)
  docs/architecture.md
```

## Quickstart — WP1 (zero dependencies)

```bash
cd trinetra/backend
python run_sim.py --list                 # show scenarios
python run_sim.py --scenario vizag       # watch the lethal build-up minute-by-minute
python run_sim.py --scenario hotwork_no_gas   # false-positive control
```

Requires **Python 3.10+**. The WP1 digital twin uses the standard library only — no install needed.

What you'll see in `vizag`: gas climbing under an active hot-work permit with 3 workers in a confined space, yet **every single-sensor stays "clear" until t≈14 min**. That blind window is exactly what the compound engine (WP2) converts into life-saving lead time.

## Roadmap

- [x] **WP1** — Plant digital twin + scenario injector + scaffold
- [ ] **WP2** — Compound-risk engine + 25-scenario benchmark (lead time, FN-reduction vs single-sensor)
- [ ] **WP3** — Next.js control-room dashboard + real-time geospatial heatmap (FastAPI + WebSocket)
- [ ] **WP4** — LangGraph multi-agent layer + Gemini RAG + YOLOv8 CCTV vision
- [ ] **WP5** — Emergency Response Orchestrator + incident report + knowledge graph + multilingual alerts
- [ ] **WP6** — Vizag backtest write-up + demo video + pitch deck + architecture diagram

## Tech stack

Python · FastAPI · LangGraph · LangChain · ChromaDB · Ultralytics YOLOv8 · Google Gemini · (optional) Neo4j · Next.js · React · TypeScript · Tailwind.

## How it maps to the judging rubric

| Criterion | Weight | Where Trinetra earns it |
|---|---|---|
| Innovation | 25% | Compound-risk fusion — not another single-sensor alarm |
| Business Impact | 25% | Lives + ₹ + the Vizag story + quantified lead-time |
| Technical Excellence | 20% | 4-modality fusion, hybrid rules+LLM, reproducible benchmark |
| Scalability | 15% | Standard SCADA/IoT formats, digital-twin → real deployment |
| User Experience | 15% | Control-room dashboard + multilingual field alerts |
