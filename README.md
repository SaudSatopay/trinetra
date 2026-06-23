<div align="center">

# 🛡️ TRINETRA

### *the third eye that sees the danger no single sensor can*

**An AI compound-risk intelligence layer for zero-harm industrial operations.**
Trinetra fuses gas sensors, permits, CCTV and shift logs into one real-time brain that catches the **lethal combinations** every individual safety system rates as "normal" — *minutes before they kill.*

[![CI](https://github.com/SaudSatopay/trinetra/actions/workflows/ci.yml/badge.svg)](https://github.com/SaudSatopay/trinetra/actions/workflows/ci.yml)
![License](https://img.shields.io/badge/license-MIT-ff6a1a)
![Python](https://img.shields.io/badge/python-3.10-e8862f?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-f7efe1?logo=next.js&logoColor=black)
![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-ff2b4e?logo=googlegemini&logoColor=white)

**`100%` compound recall** · **`0%` false-positive** · **`7.4 min` mean early-warning**

</div>

---

## Contents

- [The 8 minutes that should not have been silent](#the-8-minutes-that-should-not-have-been-silent)
- [The thesis: compound risk](#the-thesis-compound-risk)
- [The moment that wins the room](#the-moment-that-wins-the-room-)
- [Architecture](#architecture)
- [The compound-risk engine](#the-compound-risk-engine-the-core-ip)
- [The multi-modal brain](#the-multi-modal-brain)
- [The knowledge graph](#the-knowledge-graph)
- [Evidence — how we know it works](#evidence--how-we-know-it-works)
- [Capabilities](#capabilities)
- [The control room](#the-control-room)
- [Deployment — a connector, not a rewrite](#deployment--a-connector-not-a-rewrite)
- [Quickstart](#quickstart)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Testing & CI](#testing--ci)
- [Honest caveats](#honest-caveats)

---

## The 8 minutes that should not have been silent

On **13 January 2025, eight workers died** in a coke-oven-battery explosion at the **Visakhapatnam Steel Plant**. The gas sensors had data. The permits were logged. SCADA was running. **No layer connected those signals in time.**

In India's registered factories alone, **about three workers die every day** ([DGFASLI / Ministry of Labour data](https://www.indiaspend.com/special-reports/3-workers-die-every-day-in-indian-factories-govt-data-show-850083)) — and that counts only the organised sector. The bottleneck is not missing sensors. It is the missing **intelligence layer**.

## The thesis: compound risk

Fatalities are rarely one sensor screaming. They are a **combination** that each looks normal:

```
   rising (but sub-alarm) flammable gas
 + an active hot-work permit  (ignition source)
 + personnel inside a confined space
 ─────────────────────────────────────────────
 = a lethal combination NO single sensor flags
```

**Three green lights. One lethal combination.** Trinetra detects it — and acts — *before* the alarm. The decision is made by a transparent, deterministic engine; the LLM never makes the life-safety call.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#15110d','primaryTextColor':'#f7efe1','primaryBorderColor':'#ff6a1a','lineColor':'#8a7d6a','fontFamily':'ui-monospace, monospace'}}}%%
flowchart TD
  A["Per-zone sensor frame (every minute)"] --> B{"Flammable evidence?<br/>level over 50% of alarm and rising<br/>OR level over 70%"}
  B -- no --> N["NORMAL / WATCH"]
  B -- yes --> C{"Ignition source<br/>in-zone OR adjacent?"}
  C -- no --> G["Gas anomaly only<br/>(context-blind) — no compound"]
  C -- yes --> D{"Personnel in-zone<br/>OR within blast radius?"}
  D -- no --> G
  D -- yes --> E["🔴 COMPOUND HAZARD<br/>score · lead-time · ranked interventions"]
```

## The moment that wins the room 🎯

While the incident develops, the two systems live in **split realities**:

| | LEGACY single-sensor | TRINETRA compound AI |
|---|---|---|
| **t = 8 min** | 🟢 **ALL CLEAR** — every gas below its setpoint | 🔴 **COMPOUND ALERT** — COB-1 critical · breach predicted · evacuate now |
| **t = 14 min** | 🔴 first gas alarm (CH4) | (screaming for 6 minutes already) |

**+6 minutes of early warning** — while every gas sensor still reads below its setpoint. Six minutes is the window an operator gets to suspend the permit and clear the floor before ignition.

---

## Architecture

A **hybrid** brain across three layers: a digital-twin (or live-connector) **data** layer, a deterministic-first **intelligence** layer, and a real-time control-room **presentation** layer.

![Architecture](docs/architecture.svg)

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#15110d','primaryTextColor':'#f7efe1','primaryBorderColor':'#ff6a1a','lineColor':'#8a7d6a','clusterBkg':'#0f0c0a','clusterBorder':'#3b2e22','fontFamily':'ui-monospace, monospace'}}}%%
flowchart LR
  subgraph DATA["DATA — digital twin / connectors"]
    SIM["Plant Simulator<br/>6 zones · seed 42"]
    CSV["SCADA / permit CSV<br/>/api/ingest"]
    CAM["CCTV frame<br/>YOLOv8"]
  end
  subgraph INTEL["INTELLIGENCE — deterministic-first"]
    ENG["⚙️ Compound-Risk Engine<br/>auditable scoring"]
    KG["🕸️ Knowledge Graph<br/>networkx"]
    AG["🤖 LangGraph<br/>6-stage reasoning"]
    RAG["📚 Disaster-Memory RAG<br/>Gemini embeddings"]
    RESP["🚨 Response Orchestrator"]
  end
  subgraph PRES["PRESENTATION"]
    HMI["🖥️ Next.js control room"]
  end
  SIM --> ENG
  CSV --> ENG
  CAM --> AG
  KG -.blast radius.-> ENG
  ENG --> AG --> RAG
  ENG --> RESP
  ENG --> HMI
  RAG --> HMI
  RESP --> HMI
```

> **Why hybrid?** Industry juries (rightly) distrust a language model making a life-safety call. So the **decision** is a transparent, reproducible score with explicit thresholds; Gemini only *explains* the decision, *retrieves* historical precedent, and *drafts* the report. If the model is down, the safety call is unaffected.

---

## The compound-risk engine (the core IP)

[`backend/app/engine/compound.py`](backend/app/engine/compound.py) — a deterministic, baseline-subtracted scorer where **context multiplies the gas signal**:

```
score = 100 · raw · (1 + ignition + personnel + confined)

  raw       = Wₗ·(flammable level − background) + Wₛ·(projected rise) + Wₜ·toxic + W₂·O₂-deficit
  ignition  = 0.8 in-zone · 0.4 adjacent  (blast radius)
  personnel = 0.5 if anyone is in the blast radius
  confined  = 0.6 · O₂-deficit in a confined space
```

What makes it more than a threshold dashboard:

- **Baseline-subtracted** — a coke oven's normal background gas never manufactures risk.
- **Predictive** — extrapolates the trend to a **time-to-threshold** ("breach in ~36 min"), so it's anticipatory, not reactive.
- **Prescriptive** — ranks the single most effective intervention by *counterfactual* risk reduction ("suspend hot-work permit → −85%"), computed on the uncapped score.
- **Cross-zone blast-radius** — both ignition *and* personnel exposure propagate to adjacent zones, so "gas here, the crew next door" is still a compound hazard.
- **Calibrated confidence** — a 128-draw Monte-Carlo over the per-sensor noise model reports how robust the verdict is ("alert confidence 92%, breach ~36 ± 3 min").

Everything is deterministic given the simulator seed, so every number below is reproducible.

## The multi-modal brain

| | Capability | Endpoint |
|---|---|---|
| ⚙️ | **Compound engine** — catches danger *below* single-sensor thresholds | `100% recall · 0% FP` |
| 👁️ | **Computer vision** — YOLOv8 person + restricted-zone-intrusion on a sample frame | `/api/vision` |
| 🤖 | **Reasoning graph** — LangGraph **6-stage auditable trace** (deterministic stages) | `/api/agents` |
| 📚 | **Disaster memory (RAG)** — matches live conditions to real disasters via Gemini embeddings | `81% Vizag match` |
| 🚨 | **Autonomous response** — OISD/Factory-Act incident report + **EN/Telugu/Hindi** alerts | `/api/response` |

…plus **predictive time-to-threshold**, **prescriptive interventions**, **cross-zone blast-radius reasoning**, **pre-mortem hazard discovery**, and a **knowledge graph**.

The reasoning graph is a **compiled LangGraph `StateGraph`** with a full auditable trace — deterministic feature-extraction stages, *not* autonomous LLM agents (by design, so the life-safety path is reproducible):

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#15110d','primaryTextColor':'#f7efe1','primaryBorderColor':'#ff6a1a','lineColor':'#8a7d6a','fontFamily':'ui-monospace, monospace'}}}%%
flowchart LR
  S["① Sensor"] --> P["② Permit<br/>(+ conflict check)"] --> V["③ Vision"] --> R["④ Compound<br/>Reasoner"]
  R -->|compound| CX["⑤ Context-RAG"] --> RP["⑥ Response"]
  R -.->|benign| EN["end"]
```

## The knowledge graph

The domain safety-knowledge is encoded as a real graph ([`backend/app/kg/graph.py`](backend/app/kg/graph.py), networkx) — **27 nodes / 36 edges** — and rendered **live in the control room** (toggle *Knowledge graph →* on the plant panel). It also powers blast-radius reachability.

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#15110d','primaryTextColor':'#f7efe1','primaryBorderColor':'#ff6a1a','lineColor':'#8a7d6a','fontFamily':'ui-monospace, monospace'}}}%%
flowchart LR
  G1["Gas: CH4 / CO / H2S"] --> PR1["Flammable gas ↑"]
  G2["Gas: O2"] --> PR4["Confined · O₂"]
  PM1["Permit: hot-work"] --> PR2["Ignition source"]
  PM2["Permit: confined entry"] --> PR4
  PR1 --> HZ["🔴 COMPOUND HAZARD"]
  PR2 --> HZ
  PR3["Personnel present"] --> HZ
  PR4 --> HZ
  HZ -.precedent.- IN["8 documented incidents<br/>Vizag · Piper Alpha · Texas City …"]
  ZN["Plant zones"] -.blast radius adjacency.- HZ
```

---

## Evidence — how we know it works

> The full methodology and every table live in **[docs/BACKTEST.md](docs/BACKTEST.md)**. All numbers are reproducible (fixed seed 42).

### Benchmark — 25 labelled scenarios

| Metric | Trinetra |
|---|---|
| Compound-hazard detection **recall** | **100%** (14 / 14) |
| **False-positive** rate (14 hard negatives, incl. inerted) | **0%** |
| Mean **early-warning** over single-sensor | **7.4 min** (median 6, max 12) |

### Ablation — is the full fusion necessary?

| Detector tier | Recall | False-alarm | Lead |
|---|---|---|---|
| Single-sensor threshold (incumbent) | 100% | 71% | 0 min |
| Gas-trend rule (**no context**) | 100% | 71% | 7.4 min |
| **Trinetra (full compound fusion)** | 100% | **0%** | **7.4 min** |

Context is what turns *early* detection into *actionable* early detection (71% → 0% false alarms at the same lead).

### Generalization — held-out, unseen seeds

**240 randomized scenarios** at seeds the thresholds were never tuned on → **100% recall, 3.3% false-positive**. Not overfit to the curated 28.

### Real-incident replay — independent validation

Reconstructed from **two** real inquiries and replayed through the *same* engine, no tuning. **U.S. CSB BP Texas City (2005):** the compound alert fires at **T+10 — ten minutes before the vapour-cloud ignition the CSB documented at T+20** (7 before any single sensor). **MB Lal Jaipur (2009):** **T+12 — 36 minutes before** the documented ignition of a long, undetected vapour build-up. *Honest mapping* — neither site had a working gas detector (a finding in both inquiries), so the documented vapour escalation is mapped onto the flammable channel; the ignition timing and the personnel are the inquiry's. *(In-app: connector → **Texas City · CSB '05** / **Jaipur · MB Lal '09**.)*

---

## Capabilities

| | | |
|---|---|---|
| 📊 **Ablation proof** | context fusion vs naive tiers — 71% → 0% false alarms | `python ablation.py` |
| 🎲 **Generalization** | 240 held-out randomized scenarios → 100% recall / 3.3% FP | `python test_generalization.py` |
| 🧯 **Real-incident replay** | CSB Texas City (2005) → fires 10 min before the documented ignition | `/api/incident/texas-city` |
| 🔮 **Pre-mortem discovery** | searches the plant for lethal combinations that *haven't happened yet* | `/api/premortem` |
| 🏭 **Fleet command** | the same engine across a fleet of plants on one board — the scalability story made concrete | `/api/fleet` |
| 🚫 **Shift-left permit gate** | refuses a permit that would *create* a compound hazard — prevention at the permit desk, not detection after | `/api/permit-gate` |
| 🔁 **Active-learning flywheel** | per-plant nuisance tuning from operator feedback, with a hard recall guardrail (compound always pages) | `/api/feedback` |
| 💰 **Business impact** | EV-adjusted ROI — **₹115.5 Cr** per prevented incident, **~7.7× expected annual return** (1-in-15-yr) + insurance offset | response modal |
| 🎛️ **Scenario editor** | toggle gas / ignition / personnel / blast-radius and watch the engine flip live | `/api/simulate` |
| 🔌 **SCADA connector** | replay a real SCADA/permit CSV through the same engine — *a connector, not a rewrite* | `/api/ingest` |
| 📚 **Pattern intelligence** | mines recurring causal patterns across a near-miss + incident corpus | `/api/patterns` |
| ✅ **Compliance & audit** | live OISD / DGMS / Factory-Act audit — per-zone deviations + corrective actions | `/api/compliance` |
| 🛟 **Demo-safe** | cached/golden fallbacks keep the room functional if the LLM is rate-limited; **Judge Mode** jumps to the money shot | `TRINETRA_DEMO_MODE=1` |

> **Full problem-statement coverage** — all six illustrative builds: three as the production core (**Compound Risk Engine · Digital Permit Intelligence · Emergency Response Orchestrator**) and three as focused, working MVPs (**Geospatial Safety Heatmap · Incident Pattern Intelligence · Quality & Compliance Audit Agent**) — across every suggested technology (multi-agent · geospatial · RAG · CV · IoT/SCADA · knowledge graph).

## The control room

A bespoke, instrument-grade HMI (Next.js 14 + a "foundry" design system — warm ink, a molten-orange signature, and a risk ramp that visibly *heats up*):

- **Geospatial plant schematic** — a continuous risk heat-field, flowing blast-radius links, worker-location markers, a 270° risk gauge.
- **Plant / Fleet / Knowledge toggle** — the geospatial plant, the multi-plant fleet board, or the reasoning graph, in the main panel.
- **Fleet command** — one engine across six plants, ranked compound-first, with the live aggregate (plants · workers · compound now · exposed · max lead).
- **Threat panel** — score, level, projected breach (± confidence), the "why" factors, the ranked prescriptive intervention.
- **Split-reality readout** — *Legacy: all clear* vs *Trinetra: compound alert · +N min*.
- **Disaster-memory card**, **CCTV/YOLOv8 tile**, **scenario editor**, **SCADA connector**, **Safety-Intelligence chips** (compliance · patterns · pre-mortem · **permit gate** · **learning** · reasoning), and an auto-popping **autonomous-response modal**.
- **Judge Mode** — one click resets to the Vizag hero, 4×, and jumps to the money shot.
- **Booth / attract mode** — an unattended ~60-second kiosk loop (Vizag → Texas City → fleet → cross-zone → a silent hard negative) that sounds a siren and a spoken evacuation on every compound hazard; one click to start, with a mute toggle.

## Deployment — a connector, not a rewrite

The digital twin and a real plant feed are the *same* interface — the engine cannot tell the difference:

```mermaid
%%{init: {'theme':'base','themeVariables':{'primaryColor':'#15110d','primaryTextColor':'#f7efe1','primaryBorderColor':'#ff6a1a','lineColor':'#8a7d6a','fontFamily':'ui-monospace, monospace'}}}%%
flowchart LR
  H["Plant historian<br/>OPC-UA / MQTT / PI"] --> E["Edge pre-filter"] --> C["SCADA CSV"] --> I["/api/ingest"] --> EN["Same compound engine<br/>O(zones)"] --> UI["Control room"]
```

The engine is `O(zones)` per frame: **measured ~696k sensor tags/sec on a single core** (`python throughput.py`), so a 10,000-tag plant assesses in **~14 ms per 1 Hz frame — ≈70× real-time, no GPU**. The **fleet view** (`/api/fleet`) runs that same engine across many plants on one board: no per-site retraining, horizontally shardable.

---

## Quickstart

**One command** (Windows) — starts both servers and opens the control room:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/demo.ps1
```

…or run them manually:

**Backend** (Python 3.10+)
```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # (Unix: source .venv/bin/activate)
pip install -r requirements.txt
# optional: put a key in backend/.env  ->  GEMINI_API_KEY=...   (without it, the AI layer serves vetted cached analysis)
python -m uvicorn app.api.server:app --app-dir .    # http://127.0.0.1:8000
```

**Frontend** (Node 18+)
```bash
cd frontend
npm install
npm run dev                                          # http://localhost:3000
```

Open **http://localhost:3000**, let the `vizag` scenario play to ~t8, and watch COB-1 ignite while the legacy side stays "All clear." For a bulletproof demo, set `TRINETRA_DEMO_MODE=1` (instant cached AI; embeddings stay live).

**Zero-install core** — the engine + benchmarks are pure standard library (no pip needed):
```bash
cd backend
python run_engine.py --scenario vizag      # engine vs single-sensor, live in the terminal
python benchmark.py                         # the headline metrics
```

## API reference

FastAPI service — **25 REST routes + a WebSocket stream** (the stream endpoint exists for push deployments; the demo control room replays precomputed frames so the timeline is scrubbable). Base: `http://127.0.0.1:8000`.

| Route | Purpose |
|---|---|
| `GET /api/health` | service status |
| `GET /api/scenarios` | available scenarios (hero, decoys, cross-zone) |
| `GET /api/plant` | static plant geometry + gas thresholds |
| `GET /api/frames/{scenario}` | full precomputed run (the dashboard scrubs this) |
| `WS  /ws` | live frame stream at a chosen speed |
| `GET /api/simulate` | ad-hoc scenario from the editor's toggles |
| `GET /api/ingest/sample` · `POST /api/ingest` | download / replay a SCADA-permit CSV |
| `GET /api/incident/texas-city` · `…/texas-city.csv` | the CSB Texas City reconstruction + raw feed |
| `GET /api/agents` | the 6-stage reasoning trace |
| `GET /api/disaster-memory` | closest historical precedent + grounded briefing |
| `GET /api/vision` | YOLOv8 person / zone-intrusion detection |
| `GET /api/response` | autonomous response: actions, report, multilingual alerts, impact |
| `GET /api/knowledge-graph` | the networkx knowledge graph (nodes + edges) |
| `GET /api/patterns` | incident-pattern intelligence |
| `GET /api/compliance` | live OISD / DGMS / Factory-Act audit |
| `GET /api/ablation` | the three-tier ablation study |
| `GET /api/premortem` | pre-mortem hazard discovery |
| `GET /api/fleet` | multi-plant fleet rollup — the same engine across every site |
| `GET /api/permit-gate` | shift-left permit gate — block / conditional / clear verdict |
| `GET/POST /api/feedback` · `POST /api/feedback/reset` | operator-feedback flywheel — per-plant nuisance tuning |

## Project structure

```
trinetra/
├── backend/
│   ├── app/
│   │   ├── engine/compound.py   # ⚙️ the compound-risk engine (core IP)
│   │   ├── simulator.py         # the 6-zone digital twin
│   │   ├── scenarios.py         # hero + decoys + cross-zone scenarios
│   │   ├── constants.py         # zones, gas thresholds, sensor-noise model
│   │   ├── domain.py            # dataclasses + enums
│   │   ├── agents/graph.py      # 🤖 LangGraph 6-stage reasoning graph
│   │   ├── ai/                  # Gemini client · disaster-memory RAG · incident reports · patterns · golden fallbacks
│   │   ├── kg/graph.py          # 🕸️ networkx knowledge graph
│   │   ├── vision/detector.py   # 👁️ YOLOv8 detector
│   │   ├── impact.py            # 💰 EV-adjusted ROI model
│   │   ├── compliance.py        # ✅ OISD/DGMS/Factory-Act audit
│   │   ├── premortem.py         # 🔮 pre-mortem hazard discovery
│   │   ├── fleet.py             # 🏭 multi-plant fleet rollup (one engine, N sites)
│   │   ├── permit_gate.py       # 🚫 shift-left permit-issuance gate
│   │   ├── feedback.py          # 🔁 operator-feedback / active-learning flywheel
│   │   ├── replay.py            # 🔌 SCADA / real-incident CSV connector
│   │   └── api/                 # FastAPI service + serialization
│   ├── benchmark.py · ablation.py · test_robustness.py · test_generalization.py · smoke_api.py
├── frontend/                    # Next.js 14 control room (app/ · components/ · lib/)
├── docs/                        # architecture.svg · BACKTEST.md · deck · DEMO_SCRIPT.md
└── scripts/demo.ps1             # one-command launcher
```

## Testing & CI

GitHub Actions runs the full suite on every push (badge above):

```bash
cd backend
python benchmark.py            # 100% recall / 0% FP / 7.4 min
python ablation.py             # 71% → 0% false alarms
python test_robustness.py      # 5 sensor/permit fault modes
python test_generalization.py  # 240 held-out scenarios
python smoke_api.py            # REST + WebSocket smoke
```

## Honest caveats

- The demo runs on a **digital twin**, not a live plant — by necessity in a build sprint. It ingests standard SCADA/IoT/permit formats, so real-plant data enters the *same* engine through the `/api/ingest` connector (proven by the Texas City replay).
- The 25 benchmark scenarios were authored by us, but include **hard negatives** the engine must reject; the held-out generalization run (240 unseen-seed scenarios) and the CSB Texas City replay address the "train = test" critique.
- The headline metrics are measured on the **compound flag** (the lethal pattern), distinct from ordinary gas alarms — the value is the *combination* and the *lead time*.
- The reasoning "agents" are **deterministic feature-extraction stages**, not autonomous LLM agents — a strength for a reproducible life-safety path.
- Three of the six builds (geospatial, pattern-mining, compliance) are **focused MVPs**; the compound engine, permit intelligence and response orchestrator are the production core.

---

<div align="center"><br><sub>Built for the <b>ET AI Hackathon 2.0</b> · Problem Statement #1 — AI-Powered Industrial Safety Intelligence · <a href="LICENSE">MIT</a></sub></div>
