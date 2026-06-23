# Trinetra — Backtest & Evaluation

> How we know it works: a **reproducible** benchmark of the compound-risk engine against the single-sensor baseline it is meant to beat.

## The claim

Most industrial fatalities are caused not by one sensor crossing a threshold, but by a **combination** of conditions that are each individually "normal." Trinetra's compound-risk engine detects these combinations **before** any single sensor alarms. This document quantifies that.

## Method

- **Digital twin.** A deterministic 6-zone integrated-steel-plant simulator (`backend/app/simulator.py`) generates per-zone gas (CH4 %LEL, CO & H2S ppm, O2 %vol), temperature and pressure with realistic per-species sensor noise. Fixed seed (`42`) → every number below is reproducible.
- **Single-sensor baseline (the incumbent).** A gas is "in alarm" when it crosses its statutory setpoint (Factory Act / OISD-style: CH4 10 %LEL, CO 50 ppm, H2S 10 ppm, O2 19.5 %vol).
- **Trinetra.** The engine (`backend/app/engine/compound.py`) fuses flammable-gas **level + trend**, **ignition** permits (in-zone *and* adjacent / blast-radius), **personnel** presence and confined-space **O2** into a per-zone risk score, a compound flag, and a predicted time-to-threshold. *Hybrid:* a deterministic, auditable scoring backbone makes the call; the LLM only explains.
- **Benchmark.** 28 labelled scenarios (`backend/benchmark.py`): **14 genuine compound hazards** (varying zone, lead gas, ramp speed, in-zone vs adjacent ignition) and **14 hard negatives** — gas releases with no ignition/personnel, permitted hot-work in clean air, transient sensor spikes, and **inerted zones where all three compound factors are present but combustion is impossible**. "Detected" = Trinetra raises a compound alert at ELEVATED+; the baseline "detects" when any gas crosses its setpoint.

## Results

| Metric | Trinetra |
|---|---|
| Compound-hazard detection **recall** | **100%** (14 / 14) |
| **False-positive** rate (hard negatives) | **0%** (0 / 14) |
| **Precision** | **100%** |
| Mean **early-warning** over single-sensor | **7.4 min** (median 6, max 12, min 4) |

> Reproduce: `cd backend && python benchmark.py`

Crucially, the 14 hard negatives are built to be genuinely hard. Some **do** trip the legacy baseline (a real gas release with nobody around) — Trinetra raises the ordinary gas alarm but does **not** escalate to a compound life-safety alert. And three are **inerted zones where rising flammable gas, a hot-work permit and crew are ALL present, yet no explosion is possible** — the atmosphere is purged below the limiting oxygen concentration. A "three boxes ticked" rule fires on those; Trinetra reasons about the full fire triangle (fuel + ignition + **oxidizer**) and correctly holds fire, with the suppression stated in its own factor list. This is the negative that proves the benchmark is *discriminating*, not self-referential: it does not simply re-detect its own definition. And the inverse is handled too — an oxygen-deficient atmosphere with **unprotected** people is its own life-safety compound (asphyxiation, the leading confined-space killer), while a lone low-O2 reading with no inerting context is treated as a **suspect sensor** rather than allowed to silently suppress an explosion alert (see Robustness).

## Ablation — is the full fusion necessary?

A fair reviewer question: would a simpler system do? We re-ran the **same** 28 scenarios under three progressively richer detectors.

| Detector tier | Recall | False-alarm rate | Precision | Mean lead |
|---|---|---|---|---|
| Single-sensor threshold (incumbent) | 100% | 71% | 67% | 0 min |
| Gas-trend rule (level + trend, **no context**) | 100% | 71% | 67% | **7.4 min** |
| **Trinetra (full compound fusion)** | 100% | **0%** | **100%** | **7.4 min** |

**The lead time is not the differentiator — precision is.** Any trend-aware rule recovers the full 7.4-minute lead; the contextual fusion adds none. What it adds is *discrimination*: with no context (ignition, personnel, blast-radius, oxidizer) the gas-trend rule raises a **non-actionable / nuisance alert on 71% of benign events** — real but harmless gas releases with nobody present, transient spikes, and inerted zones — so roughly two of every three alerts demand no life-safety response. (These are not detector faults; the single-sensor *correctly* alarms on a real gas release. They are alarms that don't require a compound response — the source of alarm fatigue, which is why alarms get ignored.) Only the contextual fusion keeps the lead **and** drops the nuisance rate to **zero**.

> Reproduce: `cd backend && python ablation.py`  ·  API: `GET /api/ablation`

## Generalization — held-out, unseen seeds

A fair critique of any 28-scenario benchmark is "you tuned the thresholds on your own test set." So we also score the engine on a **held-out** distribution it was never calibrated on: **240 randomized scenarios** (120 compound hazards + 120 decoys) with random zone, lead gas, ramp speed, peak, permit timing, in-zone vs adjacent ignition and crew size — each run at a simulator **seed ≠ 42** (the only seed the thresholds were ever set on).

| Metric (held-out · 240 scenarios) | Trinetra |
|---|---|
| Compound recall | **100%** (120 / 120) |
| False-positive rate | **3.3%** (4 / 120) |
| Precision | **96.8%** |
| Mean early-warning | **7.7 min** |

Recall holds at 100% and false positives stay at **3.3%** on scenarios the engine never saw — the thresholds generalize, they are not overfit to the curated 28. (This is still the digital twin, not live plant telemetry; real-plant data enters the *same* engine unchanged through the `/api/ingest` connector.)

> Reproduce: `cd backend && python test_generalization.py`

## Real-incident replay — independent validation (×2)

Synthetic scenarios invite the fair question *"would it catch a real one?"* So we reconstruct **two** documented disasters and replay each through the **same** connector and engine, no tuning. In both inquiries the site had *no* working gas detector (a finding in each), so the documented vapour escalation is mapped onto the flammable/LEL channel, while the ignition source and the personnel come straight from the report. The compound alert then follows from the documented sequence — not from a number we chose.

**BP Texas City refinery** — U.S. CSB final report, 23 Mar 2005 (Report No. 2005-04-I-TX): the overfilled raffinate splitter venting a ground-level vapour cloud, an idling-engine ignition source, and contractors in nearby trailers.

| Event | Time |
|---|---|
| **Trinetra compound alert** | **T + 10 min** |
| First single-sensor alarm | T + 17 min |
| Documented vapour-cloud ignition (CSB) | T + 20 min |

**Indian Oil Jaipur depot** — MB Lal Committee report, 29 Oct 2009: a petrol-vapour cloud that accumulated, undetected, across the terminal for over an hour before it found an ignition source (12 killed, an 11-day fire).

| Event | Time |
|---|---|
| **Trinetra compound alert** | **T + 12 min** |
| First single-sensor alarm | T + 40 min |
| Documented vapour-cloud ignition (MB Lal) | T + 48 min |

So the engine flags the compound risk **10 minutes** ahead of Texas City and **36 minutes** ahead of Jaipur — each on conditions it was never tuned on, each tracking the inquiry's own documented timeline. The honest part: where no detector existed, *we* chose to map the documented vapour build-up onto the gas channel; the lead then follows from the inquiry's sequence, not from a value we invented.

> Reproduce: `GET /api/incident/texas-city` and `GET /api/incident/jaipur`  ·  inspect the raw feeds with the `.csv` variants.

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
- The 28 scenarios were authored by us, but deliberately include **hard negatives** the engine must reject — including three *inerted* cases that carry all three compound factors yet are physically safe. The discrimination (0% false-positive across them) is the substantive result, not the recall.
- The headline figures are measured on the **compound flag** (the lethal pattern), which is distinct from ordinary gas alarms. Trinetra still raises ordinary alarms like any system; the value is the compound layer **and the lead time**.

## Robustness (fault modes)

Real plants have flaky sensors and out-of-sync permits. A dedicated check (`backend/test_robustness.py`) asserts the engine behaves under eight fault modes:

| Fault mode | Expected & verified behaviour |
|---|---|
| Stuck (frozen-high) sensor, no context | No compound alert — a flat high reading without ignition/personnel is not a life-safety emergency |
| Hazard appears in CO only (CH4 quiet) | Still caught — multi-gas fusion has no single-sensor blind spot |
| Transient noise spike, no context | No sustained alert — momentary spikes don't escalate |
| Delayed permit sync (ignition syncs late) | No compound before the ignition permit is live; fires once it syncs |
| Cross-zone exposure (gas + ignition here, crew next door) | Compound fires on blast-radius exposure — escalates even when the gas zone itself is unmanned |
| Oxygen-deficient entry, no supplied air | **Asphyxiation compound fires** — oxygen deficiency with unprotected people is its own life-safety hazard, independent of any explosion (the leading confined-space killer) |
| Inerted entry WITH supplied air | No compound — no oxidizer for an explosion AND the crew is protected; the engine reads the supplied-air permit, it doesn't just count three factors |
| Faulty-low O2 mid-incident | Explosion alert **not** suppressed — a lone low O2 with no inerting context is treated as a suspect sensor, so one bad reading can't silently hide a real hazard |
| Missing CCTV feed | Engine unaffected — personnel come from the permit-to-work system; `/api/vision` degrades to an error object |

> Reproduce: `cd backend && python test_robustness.py`

## Maps to the problem statement's "Evaluation Focus"

| Required focus | Trinetra result |
|---|---|
| Compound detection accuracy vs single-sensor baselines | 100% recall; +7.4 min mean lead |
| Prediction lead time before incident threshold | 6 min on the Vizag reconstruction |
| Reduction in false-negative rate (*"the metric that saves lives"*) | baseline is blind to the entire compound window until the gas alarms; Trinetra catches 14/14 |
| False-positive discipline | 0% on 14 hard negatives (incl. inerted) |
