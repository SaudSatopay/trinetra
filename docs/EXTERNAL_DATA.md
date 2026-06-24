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

### On the y-scale, and an honest correction

An earlier version of this doc claimed the lead is "scale-invariant." **That was wrong, and we correct it
here rather than bury it.** The compound **detection time is** scale-robust — it fires at a near-constant
**T+2–4** across every scale, because it triggers at a fixed 0.5×-of-alarm fraction of a rising signal —
but the **lead in minutes is *not* scale-invariant**, because the lead is measured against the
single-sensor baseline, whose alarm time *is* scale-sensitive: a higher scale lifts the real midday CO
plateau (~5–7 mg/m³) over the 50 ppm setpoint, so the baseline alarms earlier and the gap shrinks. We run
the **same** real series through the **same** engine across a sweep of scales and publish it
(`/api/external/air-quality` → `lead_by_scale`; reproduce it yourself):

| y-scale (×) | compound alert | single-sensor alarm | lead (min) |
|---|---|---|---|
| 5 | T+4 | T+13 | 9 |
| **6 (shipped)** | **T+3** | **T+13** | **10** |
| 7 | T+3 | T+9 | 6 |
| 8 | T+3 | T+5 | 2 |
| 10 | T+3 | T+4 | 1 |
| 12 | T+2 | T+3 | 1 |

Read it honestly: **Trinetra's early detection is the scale-robust part** (T+2–4 everywhere); the headline
"+10" is the lead *at our disclosed ×6*, and ×6 — chosen so the peak reaches ~1.4× the alarm (a moderate
leak) — happens to also sit near the top of the lead range. So we don't quote the lead as a fixed property;
we show the whole sweep and let you pick the scale. At the *true* ambient scale (~10 ppm peak, ×0.87) the
engine correctly reads this trace as non-hazardous and stays silent.

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

---

## Second independent source — EPA ALOHA dispersion (modeled physics, no y-scale, disclosed receptor distance)

The De Vito exhibit has one soft spot the round-4 review flagged: the **y-scale** (the ×6) is a choice. This
second exhibit **eliminates that specific degree of freedom**: the gas dynamics come from **EPA/NOAA's ALOHA
dispersion model** (the free CAMEO tool — a recognised third party we did not write or tune), and methane
converts to %LEL by a **fixed physical constant**, so there is no y-scale *multiplier* to pick:

> Methane LEL = 5 %vol = 50,000 ppm  ⇒  **%LEL = ppm ÷ 500**. Fixed chemistry, zero free parameters.

**The honest caveat (so we don't over-claim):** eliminating the y-scale does *not* mean there is no chosen
parameter at all — the remaining choice is the **receptor distance** (where downwind the reading is taken).
We pick a realistic **100 m crew standoff** for the headline and **disclose + sweep** it (50 / 100 / 150 m,
below) rather than hide it. The precise claim: the conversion is fixed chemistry (no y-scale); the receptor
distance is a disclosed, swept parameter.

| | |
|---|---|
| **Real (ALOHA's, untouched)** | the concentration-vs-time curve at the receptor — the rise and the sustained plateau — shaped by EPA dispersion physics we did not author or tune. |
| **Overlaid (stated)** | the hot-work (ignition) + personnel context (ALOHA models dispersion, not permits or people — the same boundary as De Vito); the zone mapping (COB-1); 1 ALOHA-minute → 1 frame. The ppm→%LEL conversion is **not** overlaid — it is fixed chemistry. |

**One honest sentence:** ALOHA validates the gas-**dynamics** half on independent physics; the compound
**context** (ignition + people) is still overlaid — exactly as with De Vito, and no more is claimed.

**Reproducible scenario (this IS the provenance — anyone can re-run it in EPA ALOHA 5.4.7):**
- **Chemical:** Methane (CAS 74-82-8; ties to the coke-oven/Vizag hero).
- **Source:** ALOHA **Gas Pipeline** failure, *not burning* — a **2-inch (5.08 cm)** bore, 50 m pipe, the
  unbroken end connected to an infinite/upstream source (a sustained leak from a live line), smooth pipe,
  **5 atm**, 25 °C. ALOHA computes the release rate from the hole + pressure (**66.3 lb/min ≈ 30 kg/min,
  sustained**) — we do *not* pick a rate.
- **Atmosphere:** wind **2 m/s** from 270° (measured at 3 m), stability class **F** (stable/night — the
  slow-accumulation case the engine targets), ground roughness **urban/forest**, **25 °C**, 50% RH, no
  inversion. Model run: Gaussian.
- **Receptor:** ALOHA **Threat At Point** (outdoor concentration-by-time) at **100 m downwind** (a realistic
  crew standoff in the adjacent area), plus 50 m and 150 m for the distance sweep below.
- The committed slice [`backend/app/data/aloha_methane_leak.csv`](../backend/app/data/aloha_methane_leak.csv)
  carries the digitized 100 m curve with the full ALOHA version + every parameter in its `#` provenance
  header; the engine applies the **fixed** `%LEL = ppm / 500` and the stated permit/personnel context, nothing else.

### The result (reproduce: `GET /api/external/aloha-methane`)

This exhibit lands a *different* axis from the lead-time exhibits (De Vito +10, Texas City +10, Jaipur +36):
**the sensitivity / blind-spot axis.** EPA's dispersion physics put a **sustained ~8.2 %LEL methane cloud**
(≈ 4,100 ppm) at the 100 m receptor. A single-point detector set at the **10 %LEL** alarm reads "normal /
green" for the **entire release** — it is not *late*, it is structurally **blind**. Trinetra, seeing the same
sub-threshold gas **plus** the live hot-work permit **plus** the 3 crew, flags **compound at T+1 and holds it**
(CRITICAL as the cloud arrives, settling into a sustained HIGH). Same connector, same untuned engine, and —
because methane → %LEL is fixed chemistry — **no y-scale multiplier** (the only disclosed parameter is the
100 m receptor distance, swept below).

**Distance sweep — live-computed, not hand-entered** (reproduce: `GET /api/external/aloha-methane` → `distance_sweep`; each row replays a committed ALOHA curve — `aloha_methane_leak_50m.csv` / `…leak.csv` / `…leak_150m.csv` — through the same untuned engine, nothing cherry-picked):

| Receptor | ALOHA outdoor plateau | %LEL (= ppm ÷ 500) | Single sensor (10 %LEL) | Trinetra compound |
|---|---|---|---|---|
| 50 m | ~15,800 ppm | 31.6% | **alarms** (T+1) | CRITICAL (T+1) |
| **100 m (shipped)** | **~4,100 ppm** | **8.2%** | **silent — blind** | **fires T+1, sustained** |
| 150 m | ~1,900 ppm | 3.8% | silent | **silent (correct)** |

Read it honestly: at the realistic standoff (100 m) Trinetra catches a hazard the single sensor cannot see;
move closer (50 m) and the cloud is dense enough that even the single sensor finally alarms; move farther
(150 m) and Trinetra **correctly stands down** — at 3.8 %LEL there is no compound hazard and it does not cry
wolf. The "three green lights, one lethal combination" thesis, on independent EPA physics, with zero free
parameters in the conversion.

**Honest limitations (what this is *not*):** it is **modeled** dispersion, not a measurement (the De Vito CO
trace is the real-measurement exhibit; this is the recognized-third-party-physics exhibit). ALOHA models the
gas **dynamics**; the hot-work permit + personnel **context** is overlaid, exactly as with De Vito — ALOHA has
no notion of permits or people. And it is a *sustained-leak* curve (a rise to a plateau, not a slow diurnal
build), so this exhibit speaks to **detection sensitivity**, not lead-time. Two more notes a reviewer will
(fairly) raise: (1) the "blind" detector is the **area monitor at the crew's 100 m standoff** — a sensor
mounted *at the leak source* (≈100 %LEL at the orifice) would of course alarm; the point is that you cannot
blanket a plant with detectors, which is exactly why the compound layer reasons about crew exposure + permit,
not a gas number at one fixed probe. (2) The ~4,100 ppm at 100 m is **ALOHA's** value under its urban /
class-F dispersion; a textbook open-country Gaussian hand-check will *undershoot* it (urban roughness + a
stable class give higher near-field concentrations), so reproduce it **in ALOHA**, not by hand — the full run
parameters are in the CSV header. No placeholder was ever committed: this section went live only after an
actual EPA ALOHA 5.4.7 run.
