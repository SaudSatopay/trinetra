# Trinetra — 3-Minute Demo Script & Shot List

> For recording the demo video (and rehearsing the live finale pitch). Total ≈ 3:00.
> Before recording: run `scripts/demo.ps1` (starts both servers + opens the room). The backend self-warms the hero caches on boot; for a bulletproof recording set `TRINETRA_DEMO_MODE=1` (instant cached AI). Click **Judge Mode** (top bar) any time to reset to the hero, jump to the money shot, and set 4×.

---

### 0:00 – 0:20 · The hook *(black screen → fade to dashboard, all green)*
> "On the 13th of January 2025, eight workers died in a coke-oven explosion at the Visakhapatnam Steel Plant. The gas sensors had data. The permits were logged. SCADA was running. **Nothing connected them in time.**"

**On screen:** the Trinetra control room, plant calm, COB-1 green, clock at T+00. Hit **play**.

### 0:20 – 0:45 · Normal operations
> "This is Trinetra, watching that same plant. Right now every system agrees: normal. A hot-work permit is active in the coke-oven battery. Three workers are inside a confined space below it. All routine."

**On screen:** point to the **CCTV · YOLOv8** tile detecting the workers; point to the calm split-status strip — *Legacy: All clear · Trinetra: Monitoring.*

### 0:45 – 1:30 · The split reality *(let it run to ~t8–10, or seek)*
> "Watch what happens. Methane is rising in the battery — but it's still **below** the alarm. Every single sensor reads clear. Then Trinetra does something no sensor can: it connects the rising gas to the active ignition source and the people in the room."

**On screen:** COB-1 turns **red**. The right panel snaps to **COMPOUND HAZARD**, the gauge hits CRITICAL, "**projected breach ~36 min**." The split strip now reads **Legacy: 🟢 All clear** vs **Trinetra: 🔴 Compound alert**, with **+N min** ticking up between them.

### 1:30 – 2:05 · "We've seen this death before"
> "And it recognises it. Trinetra matched these live conditions against a library of real industrial disasters."

**On screen:** the **Disaster Memory** card — **"81% match — Visakhapatnam Steel Plant coke-oven explosion, 8 killed"** — and read one line of the AI briefing. Note the precedents below (Texas City, hot-work ignition).

### 2:05 – 2:35 · The autonomous response
> "Because it's caught early, the system doesn't just alarm — it responds."

**On screen:** click **"Autonomous response initiated."** The modal opens:
- the **avoided-loss banner** — *"₹115.5 Cr prevented · 116× the platform cost"* (lives + asset + downtime + penalty, every figure sourced),
- the **evidence timeline** — permit opened → personnel entry → **Trinetra alert (T+8)** → **legacy alarm (T+14)**: the six-minute lead as an auditable sequence,
- the **action checklist** (suspend hot-work, evacuate, page response team, preserve evidence),
- the **evacuation alert** — toggle **Telugu** and **Hindi** ("in the languages the workers on that floor actually speak"),
- the **auto-drafted incident report** citing **Factory Act §36/37/38** and **OISD-STD-105**.

### 2:35 – 3:00 · The proof + close
> "On a 25-scenario benchmark, Trinetra caught every compound hazard with zero false alarms — an average of **seven minutes** before the legacy system. On the Vizag reconstruction: **six minutes** of warning, while every gas sensor still read green. And the context isn't decoration — strip it out and a naive gas-trend rule still false-alarms **64%** of the time. The fusion is what takes that to **zero**."
>
> "Six thousand five hundred deaths a year. The data already exists. **Trinetra is the layer that acts on it — before, not after.**"

*(Optional interactive beats, if time / for live Q&A: hit **`custom`** and toggle ignition off → the compound alert vanishes, on → it returns. Or hit the **connector** and upload a SCADA CSV — the same engine replays real data.)*

**On screen:** cut to the architecture diagram / the metrics line. End on the Trinetra mark.

---

## One-line pitch (for Q&A / the elevator version)
*"Trinetra is the missing intelligence layer that fuses gas sensors, permits, CCTV and shift logs to catch the lethal combinations no single sensor flags — giving safety officers minutes of warning before a fatality, not a report after one."*

## Likely judge questions — crisp answers
- **"Is this real data?"** → A digital twin in the demo, but it ingests standard SCADA/IoT/permit formats — real-plant integration is a connector, not a rewrite. *Prove it live:* upload a SCADA CSV through the connector and the same engine runs on it unchanged.
- **"How is this not just another alarm?"** → It fires on the *combination below* single-sensor thresholds, and it's measured: 100% recall / 0% false-positive / +7.4 min lead vs the baseline. The ablation shows context cuts false alarms from 64% to 0% at the same lead time.
- **"Why won't it cry wolf?"** → 11 hard-negative scenarios (gas with no ignition, permits in clean air, transients) — 0% false compound alerts. Plus fault-mode checks (stuck sensor, missing CCTV, noise spike, delayed permit) in `test_robustness.py`.
- **"What's the ROI / business case?"** → One prevented Vizag-class incident ≈ **₹115.5 Cr** avoided (lives + asset + downtime + penalty) against a ~₹1 Cr/yr platform — **116× return**.
- **"What if the AI is rate-limited mid-demo?"** → It degrades to vetted cached analysis (UI badges "cached"); the precedent match is still real (embeddings) and the room stays fully functional.
- **"Who buys it?"** → Steel, refining, petrochemical, mining — anyone running OISD/Factory-Act permit-to-work. It sits over their existing sensors.
