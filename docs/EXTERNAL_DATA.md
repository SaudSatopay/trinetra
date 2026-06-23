# External-data replay — running the engine on data it did not author

> The sharpest critique of any self-built benchmark is **circularity**: if you generated every
> scenario, then 100% recall / 0% false-positive only proves the engine is *self-consistent*, not
> that it is *correct*. The held-out generalization run (240 unseen-seed scenarios) narrows this but
> does not close it — it is still the same simulator. This page closes it the only honest way: by
> feeding the engine a **real, third-party, peer-reviewed measurement** it never produced, through
> the **same connector and the same untuned engine**, and stating exactly what is real and what is overlaid.

## The dataset

- **Source:** UCI Machine Learning Repository #360, *"Air Quality"* — S. De Vito, E. Massera, M. Piga,
  L. Martinotto, G. Di Francia, *"On field calibration of an electronic nose for benzene estimation in
  an urban pollution monitoring scenario,"* **Sensors and Actuators B** 129(2):750–757, 2008.
- **DOI:** 10.24432/C5K603 · **License:** Creative Commons Attribution 4.0 (CC BY 4.0).
- **What it is:** hourly-averaged readings from a gas multi-sensor device deployed at road level in an
  Italian city over ~1 year, **co-located with certified reference analysers**. We use the reference
  analyser's true **CO concentration** channel (`CO(GT)`, mg/m³) — a real, independently-measured value.
- **The committed slice:** [`backend/app/data/airquality_co_devito2008.csv`](../backend/app/data/airquality_co_devito2008.csv)
  holds the raw values verbatim (21 consecutive valid hours, 23 Nov 2004 05:00 → 24 Nov 2004 01:00), so
  anyone can diff them against the public dataset. It is a real winter-day urban CO accumulation: a low
  pre-dawn baseline, a gradual daytime build-up **with real dips**, an evening peak (11.9 mg/m³), then an
  overnight clear-out.

## What is real, and what is overlaid

| | |
|---|---|
| **Real (the dataset's, untouched)** | the CO concentration **trajectory** — the rise, the genuine dips, the timing, the measurement noise. This is the hard part to author convincingly, and it is not authored here. |
| **Overlaid (stated, applied in code)** | (1) a linear **y-scale ×6** mapping the dataset's mg/m³ range onto the plant's ppm band (peak 11.9 → ~71 ppm ≈ 1.4× the 50 ppm CO alarm); (2) **1 hour → 1 minute** on the time axis; (3) a **hot-work permit + 3 personnel** context the air-quality dataset has no notion of (Trinetra's compound layer needs ignition + exposure); (4) mapped to zone **COB-1**. |

The scaling does **not** manufacture the result. The lead time is **scale-invariant**: compound fires at
`flam_level = 0.5×` the alarm and the single-sensor at `1.0×`, so the gap depends only on the real data's
**shape** and the alarm ratio — multiply every value by any constant and the two crossing-minutes move
together. The ×6 only decides *whether* the trace reaches plant-hazard magnitude at all; at the true
ambient scale (~10 ppm peak) the engine correctly reads this as non-hazardous.

## The result (reproduce: `GET /api/external/air-quality`)

Replaying the real CO slice through the same `parse_csv` connector and the same untuned `CompoundRiskEngine`:

- **Trinetra compound alert: T+3 min.** **First single-sensor CO alarm: T+13 min.** → a **10-minute** early
  warning on real, externally-measured dynamics.
- **It tracks the real signal, it does not latch.** During the dataset's genuine CO dips (T+8, T+10, T+11)
  the compound flag *relaxes* — no crying wolf during a real lull — and re-escalates when the real rise
  resumes. When the CO clears overnight (T+17 onward) it stands down to NORMAL. The per-minute trace is in
  the replay payload and in the downloadable feed (`/api/external/air-quality.csv`).

This is the honest headline: **real third-party data, the same connector, zero tuning — and the engine's
trend/compound logic behaves correctly on dynamics it never saw.**

## Honest limitations (what this is *not*)

- It is **not a pilot.** A real industrial deployment also needs real permits, real personnel positions, and
  a real flammable-gas leak — none of which a roadside air-quality monitor provides. The CO **dynamics** are
  real; the **hazard context** is still overlaid.
- It is **ambient CO**, not a coke-oven leak. We scale the trend to industrial magnitude; we do not claim the
  measured concentrations were themselves dangerous.
- One real channel (CO) maps cleanly to a Trinetra gas; the dataset's other species (NOx, NO₂) do not, so the
  other channels sit at clean baseline.

## Dataset also evaluated, and why not chosen

We first pulled **UCI #322, "Gas Sensor Array Under Dynamic Gas Mixtures"** (Fonollosa et al., 2015) — real
lab-measured **methane and CO in ppm**, the better thematic fit. But it is a *sensor-characterisation* rig
that switches concentration setpoints every few seconds, so even at 1-minute averages it has **no slow
build-up** (it reads e.g. 0 → 290 → 5 ppm between adjacent minutes). The De Vito set's gradual, dip-laden
diurnal CO accumulation is the far more honest match for the "deceptive slow build-up" the engine targets,
so we chose it. The gas-sensor-array set remains a candidate for a future "robustness on messy real data" exhibit.
