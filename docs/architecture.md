# Trinetra — Architecture

## 1. Design principles

1. **Compound over single-sensor.** The product exists to detect danger that lives in the *combination* of signals, below any single alarm. Every design choice serves this.
2. **Hybrid decisioning.** A deterministic, auditable scoring backbone makes the safety call; the LLM explains, retrieves regulation, and drafts reports. Never let a language model be the sole arbiter of a life-safety decision.
3. **Digital twin first.** No live plant feed is available in a sprint, so we simulate one — and treat that as a *feature*: a safe, replayable environment that ingests standard SCADA/IoT/permit formats, giving an obvious path to real deployment.
4. **Reproducible evaluation.** A fixed seed makes every backtest and benchmark number explicit and testable — exactly what the problem's "Evaluation Focus" demands.

## 2. Layers

### Data layer — the digital twin (WP1 ✅)
- `PlantSimulator` advances a 6-zone integrated steel plant one timestep at a time.
- Per zone, per gas: `value = baseline + bounded AR(1) drift + Gaussian noise + scenario injection`.
- Gases modelled: **CH4 (%LEL), CO (ppm), H2S (ppm), O2 (%vol)**, plus temperature and pressure.
- Permits-to-work (hot-work, confined-space, maintenance, …) carry zone, worker IDs and a validity window; worker presence is derived from active permits.
- `scenarios.py` provides ground-truth-labelled scenarios (`expected_compound`, `hazard_zone`) and an injection function per scenario.

### Intelligence layer (WP2 / WP4)
- **Deterministic compound-risk engine (WP2):** fuses, per zone, (a) flammable-gas *trend/slope* even below alarm, (b) ignition-source permits, (c) personnel presence, (d) confined-space + O2 depletion, (e) neighbour-zone proximity (blast radius). Emits a `RiskLevel`, the contributing factors, and a **lead-time-to-threshold** estimate by extrapolating the trend.
- **LangGraph reasoning graph (WP4):** a compiled 6-stage `StateGraph` with a full auditable trace — Sensor / Permit / Vision / Context-RAG stages feed a Compound-Risk Reasoner; an Emergency Response Orchestrator acts on a confirmed threshold breach. The stages are deterministic feature extractors, not autonomous LLM agents — by design, so the life-safety path stays reproducible.
- **RAG (WP4):** Gemini embeddings + in-memory cosine similarity over a curated corpus of real industrial-incident precedents (no vector DB needed at this corpus size), with a deterministic lexical fallback when the API is unavailable — to answer *why* a combination is dangerous, grounded in the closest documented disaster.
- **Computer vision (WP4):** YOLOv8 person + restricted-zone-intrusion detection on a sample frame. PPE classification and a live camera (RTSP) feed are connectors on the same interface, not yet wired; the graph's Vision stage currently uses permit-derived headcount.

### Presentation layer (WP3)
- Next.js + React + Tailwind control room.
- Real-time **geospatial plant heatmap** (zones coloured by `RiskLevel`, worker markers, permit overlays), risk timeline, compound-risk alert cards with citations, a **Scenario Replay** control, and the auto-generated incident report.
- FastAPI backend streams snapshots + risk assessments over WebSocket.

## 3. The compound-risk signal (WP2 preview)

A zone is escalated when **multiple independent factors co-occur**, e.g.:

```
flammable_trend_rising(CH4|CO)      # positive slope, even below low-alarm
  AND ignition_source_present       # hot-work / electrical permit in zone or neighbour
  AND personnel_present             # active occupancy permit
  -> CRITICAL  (predicted threshold breach in ~N min)
```

Benign controls must stay quiet: gas-without-ignition-or-people, permitted-work-without-gas, and transient spikes are all labelled `expected_compound = False` in the benchmark.

## 4. Evaluation (WP2 / WP6)

Against a ~25-scenario benchmark we report:
- **Lead time** vs the first single-sensor alarm (headline metric),
- **Compound detection rate** and **false-negative reduction** vs the single-sensor baseline,
- **False-positive rate** on the benign controls.
