# Trinetra — Backtest & Evaluation

> How we know it works: a **reproducible** benchmark of the compound-risk engine against the single-sensor baseline it is meant to beat.

## The claim

Most industrial fatalities are caused not by one sensor crossing a threshold, but by a **combination** of conditions that are each individually "normal." Trinetra's compound-risk engine detects these combinations **before** any single sensor alarms. This document quantifies that.

## Method

- **Digital twin.** A deterministic 6-zone integrated-steel-plant simulator (`backend/app/simulator.py`) generates per-zone gas (CH4 %LEL, CO & H2S ppm, O2 %vol), temperature and pressure with realistic per-species sensor noise. Fixed seed (`42`) → every number below is reproducible.
- **Single-sensor baseline (the incumbent).** A gas is "in alarm" when it crosses its statutory setpoint (Factory Act / OISD-style: CH4 10 %LEL, CO 50 ppm, H2S 10 ppm, O2 19.5 %vol).
- **Trinetra.** The engine (`backend/app/engine/compound.py`) fuses flammable-gas **level + trend**, **ignition** permits (in-zone *and* adjacent / blast-radius), **personnel** presence and confined-space **O2** into a per-zone risk score, a compound flag, and a predicted time-to-threshold. *Hybrid:* a deterministic, auditable scoring backbone makes the call; the LLM only explains.
- **Benchmark.** 25 labelled scenarios (`backend/benchmark.py`): **14 genuine compound hazards** (varying zone, lead gas, ramp speed, in-zone vs adjacent ignition) and **11 hard negatives** — gas releases with no ignition/personnel, permitted hot-work in clean air, and transient sensor spikes. "Detected" = Trinetra raises a compound alert at ELEVATED+; the baseline "detects" when any gas crosses its setpoint.

## Results

| Metric | Trinetra |
|---|---|
| Compound-hazard detection **recall** | **100%** (14 / 14) |
| **False-positive** rate (hard negatives) | **0%** (0 / 11) |
| **Precision** | **100%** |
| Mean **early-warning** over single-sensor | **7.4 min** (median 6, max 12, min 4) |

> Reproduce: `cd backend && python benchmark.py`

Crucially, the 11 hard negatives include scenarios that **do** trip the legacy baseline (a real gas release with nobody around) — Trinetra correctly raises the ordinary gas alarm but does **not** escalate to a compound life-safety alert. It discriminates; it doesn't just fire on everything.

## Ablation — is the full fusion necessary?

A fair reviewer question: would a simpler system do? We re-ran the **same** 25 scenarios under three progressively richer detectors.

| Detector tier | Recall | False-alarm rate | Precision | Mean lead |
|---|---|---|---|---|
| Single-sensor threshold (incumbent) | 100% | 64% | 67% | 0 min |
| Gas-trend rule (level + trend, **no context**) | 100% | 64% | 67% | **7.4 min** |
| **Trinetra (full compound fusion)** | 100% | **0%** | **100%** | **7.4 min** |

Early detection alone is easy: the gas-trend rule recovers the full 7.4-minute lead. But with no context (ignition, personnel, blast-radius) it fires on **64% of benign gas events** — releases with nobody present, transient spikes — so two of every three alerts are false. That is the definition of alarm fatigue, and alarm fatigue is why alarms get ignored. Only the contextual fusion keeps the lead **and** drops false alarms to **zero**. Context is what turns early detection into *actionable* early detection.

> Reproduce: `cd backend && python ablation.py`  ·  API: `GET /api/ablation`

## The Vizag backtest (hero scenario)

Reconstructing the conditions of the **13 January 2025 Visakhapatnam coke-oven-battery explosion** (8 fatalities): slow coke-oven-gas accumulation in Battery #1 while a hot-work permit (ignition) and a confined-space entry (3 personnel) are active.

| t (min) | Single-sensor | Trinetra |
|---|---|---|
| 0–5 | clear | NORMAL |
| **8** | clear | **COMPOUND ALERT** (elevated) |
| 10 | clear | CRITICAL |
| **14** | **first gas alarm** (CH4) | CRITICAL |

**Lead time: 6 minutes** — every gas reads below its setpoint while the lethal pattern is already forming. Six minutes is the window an operator gets to suspend the permit and clear the floor before ignition.

> Reproduce: `cd backend && python run_engine.py --scenario vizag`

## Honest caveats (where it is, and is not, magic)

- The benchmark runs on a **digital twin**, not a live plant — by necessity in a build sprint. The twin ingests standard SCADA / IoT / permit formats, so the path to real data is a **connector, not a rewrite**.
- The 25 scenarios were authored by us, but deliberately include **hard negatives** the engine must reject. The discrimination (0% false-positive across them) is the substantive result.
- The headline figures are measured on the **compound flag** (the lethal pattern), which is distinct from ordinary gas alarms. Trinetra still raises ordinary alarms like any system; the value is the compound layer **and the lead time**.

## Robustness (fault modes)

Real plants have flaky sensors and out-of-sync permits. A dedicated check (`backend/test_robustness.py`) asserts the engine behaves under four fault modes:

| Fault mode | Expected & verified behaviour |
|---|---|
| Stuck (frozen-high) sensor, no context | No compound alert — a flat high reading without ignition/personnel is not a life-safety emergency |
| Hazard appears in CO only (CH4 quiet) | Still caught — multi-gas fusion has no single-sensor blind spot |
| Transient noise spike, no context | No sustained alert — momentary spikes don't escalate |
| Delayed permit sync (ignition syncs late) | No compound before the ignition permit is live; fires once it syncs |
| Missing CCTV feed | Engine unaffected — personnel come from the permit-to-work system; `/api/vision` degrades to an error object |

> Reproduce: `cd backend && python test_robustness.py`

## Maps to the problem statement's "Evaluation Focus"

| Required focus | Trinetra result |
|---|---|
| Compound detection accuracy vs single-sensor baselines | 100% recall; +7.4 min mean lead |
| Prediction lead time before incident threshold | 6 min on the Vizag reconstruction |
| Reduction in false-negative rate (*"the metric that saves lives"*) | baseline is blind to the entire compound window until the gas alarms; Trinetra catches 14/14 |
| False-positive discipline | 0% on 11 hard negatives |
