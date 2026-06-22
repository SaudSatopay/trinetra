<div align="center">

# 🛡️ TRINETRA

### The third eye that sees the danger no single sensor can.

**An AI compound-risk intelligence layer for zero-harm industrial operations.**
Trinetra fuses gas sensors, permits, CCTV and shift logs into one real-time brain that catches the **lethal combinations** every individual safety system rates as "normal" — *minutes before they kill.*

`compound engine` · `YOLOv8 vision` · `LangGraph agents` · `Gemini RAG` · `Next.js HMI`

**100% compound recall** · **0% false-positive** · **7.4 min mean early-warning**

[![CI](https://github.com/SaudSatopay/trinetra/actions/workflows/ci.yml/badge.svg)](https://github.com/SaudSatopay/trinetra/actions/workflows/ci.yml) · MIT licensed

</div>

---

## The 8 minutes that should not have been silent

On **13 January 2025, eight workers died** in a coke-oven-battery explosion at the **Visakhapatnam Steel Plant**. The gas sensors had data. The permits were logged. SCADA was running. **No layer connected those signals in time.** India records **6,500+ fatal workplace accidents a year**. The bottleneck is not missing sensors — it is the missing *intelligence layer*.

## The thesis: compound risk

Fatalities are rarely one sensor screaming. They are a **combination** that each looks normal:

```
   rising (but sub-alarm) flammable gas
 + an active hot-work permit  (ignition source)
 + personnel inside a confined space
 ─────────────────────────────────────────────
 = a lethal combination NO single sensor flags
```

**Three green lights. One lethal combination.** Trinetra detects it — and acts — *before* the alarm.

## The moment that wins the room 🎯

While the incident develops, the two systems live in **split realities**:

| | LEGACY single-sensor | TRINETRA compound AI |
|---|---|---|
| t = 8 min | 🟢 **ALL CLEAR** | 🔴 **COMPOUND ALERT** |
| | *every gas below its setpoint* | *COB-1 critical · breach predicted · evacuate now* |

**+6 minutes of early warning** — the difference between an evacuation and a funeral.

## Five differentiators (the multi-modal brain)

| | | |
|---|---|---|
| 🟢 **Compound engine** | catches danger *below* single-sensor thresholds | `100% recall · 0% FP` |
| 👁️ **Computer vision** | YOLOv8 — worker + restricted-zone-intrusion on CCTV | `/api/vision` |
| 🤖 **Multi-agent** | LangGraph 6-agent auditable pipeline | `/api/agents` |
| 📚 **Disaster memory (RAG)** | matches live conditions to real disasters via Gemini | `81% Vizag match` |
| 🚨 **Autonomous response** | OISD/Factory-Act incident report + **Telugu/Hindi** alerts | `/api/response` |

…plus **predictive time-to-threshold**, **prescriptive interventions** ("suspend permit PTW-7741 → risk CRITICAL→ELEVATED"), **cross-zone blast-radius reasoning**, and a **knowledge graph** — all in a clean, instrument-grade control room.

## Proof, impact, and interactivity

| | | |
|---|---|---|
| 📊 **Ablation proof** | single-sensor → gas-trend-only → full fusion: same 7.4 min lead, but false alarms drop **64% → 0%** | `python ablation.py` |
| 💰 **Business impact** | avoided-loss model with every figure sourced — **₹115.5 Cr** per prevented Vizag-class incident, **116× ROI** | response modal |
| 🎛️ **Scenario editor** | judges toggle gas / ignition / personnel / blast-radius and watch the engine flip live | `/api/simulate` |
| 🔌 **SCADA connector** | upload a real SCADA/permit CSV and replay it through the same engine — *a connector, not a rewrite* | `/api/ingest` |
| 📚 **Pattern intelligence** | mines recurring causal patterns across a near-miss + incident corpus → ranked prevention priorities | `/api/patterns` |
| ✅ **Compliance & audit** | continuous OISD / DGMS / Factory-Act audit of the live plant — deviations + corrective actions | `/api/compliance` |
| 🛟 **Demo-safe** | cached/golden fallbacks keep the room fully functional if the LLM is rate-limited; **Judge Mode** jumps to the money shot in one click | `TRINETRA_DEMO_MODE=1` |

> **Full problem-statement coverage** — Trinetra implements all six illustrative builds: Compound Risk Engine · Geospatial Safety Heatmap · Incident Pattern Intelligence · Digital Permit Intelligence · Emergency Response Orchestrator · Quality & Compliance Audit Agent — and every suggested technology (multi-agent · geospatial · RAG · CV · IoT/SCADA · knowledge graph).

## Architecture

![Architecture](docs/architecture.svg)

A **hybrid** brain: a transparent, deterministic scoring backbone makes the life-safety decision (no LLM hallucination in the loop); Gemini only explains, retrieves precedent, and drafts reports.

## Quickstart

**One command** (Windows) — starts both servers and opens the control room:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1
```

…or run them manually:

**Backend** (Python 3.10+):
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # (Unix: source .venv/bin/activate)
pip install -r requirements.txt
# put your key in backend/.env  ->  GEMINI_API_KEY=...
python -m uvicorn app.api.server:app --app-dir .    # http://127.0.0.1:8000
```

**Frontend** (Node 18+):
```bash
cd frontend
npm install
npm run dev                                          # http://localhost:3000
```

Then open **http://localhost:3000**, let the `vizag` scenario play to ~t8, and watch COB-1 ignite red while the legacy side stays "All clear."

**Zero-install core** — the engine + 25-scenario benchmark are pure standard library:
```bash
cd backend
python run_engine.py --scenario vizag      # engine vs single-sensor, live
python benchmark.py                         # the headline metrics
```

## API surface

`/api/frames` · `/api/plant` · `/api/scenarios` · `/api/agents` · `/api/disaster-memory` · `/api/vision` · `/api/response` · `/api/knowledge-graph` · `/api/ablation` · `/api/simulate` · `/api/ingest` · `/api/patterns` · `/api/compliance` · `/ws`

## Tech stack

Python · FastAPI · LangGraph · Google Gemini (`gemini-2.5-flash` + embeddings) · Ultralytics YOLOv8 · networkx · Next.js 14 · React · TypeScript · Tailwind.

## Docs

- [docs/BACKTEST.md](docs/BACKTEST.md) — methodology + the numbers
- [docs/architecture.md](docs/architecture.md) — design notes
- [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) — the 3-minute demo

<div align="center"><br><sub>Built for the ET AI Hackathon 2.0 · Problem Statement #1 — Industrial Safety Intelligence</sub></div>
