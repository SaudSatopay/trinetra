# Trinetra — 3-Minute Demo Script & Shot List

> For recording the demo video (and rehearsing the live finale pitch). Total ≈ 3:10.
> Before recording: run `scripts/demo.ps1` (starts both servers + opens the room). The backend self-warms the hero caches on boot; for a bulletproof recording set `TRINETRA_DEMO_MODE=1` (instant cached AI). Click **Judge Mode** (top bar) any time to reset to the hero, jump to the money shot, and set 4×.

---

### 0:00 – 0:20 · The hook *(black screen → fade to dashboard, all green)*
> "On the 13th of January 2025, eight workers died in a coke-oven explosion at the Visakhapatnam Steel Plant. The gas sensors had data. The permits were logged. SCADA was running. **Nothing connected them in time.**"

**On screen:** the Trinetra control room, plant calm, COB-1 green, clock at T+00. Hit **play**.

### 0:20 – 0:38 · Validated by the field  *(cut to the deck's "Validated by the field" slide, or hold on the calm room)*
> "And this isn't just our theory. A plant manager with **30+ years across gas and heavy industry** put the problem to us in his own words —"
>
> *"…the worst incidents were never one single failure. They were usually three or four small things lining up at the same time, each looking acceptable on its own. Most of the time, nothing actually flagged that combination before it became a serious event."*
>
> "That unflagged combination is exactly the gap. **Trinetra is that experience, encoded** — it watches every zone, 24/7, and flags the combination the moment it forms."

**On screen:** the deck's *Validated by the field* slide (full verbatim quote + attribution). *(Field validation of the problem from an industry veteran — not a customer endorsement; the bridge line is ours. Trim or drop for a strict 3:00 cut; keep it for the live pitch — it's the Business-impact beat.)*

### 0:38 – 1:00 · Normal operations
> "This is Trinetra, watching that same plant. Right now every system agrees: normal. A hot-work permit is active in the coke-oven battery. Three workers are inside a confined space below it. All routine."

**On screen:** point to the **CCTV · YOLOv8** tile — person + restricted-zone detection on a sample feed (a live plant camera is a drop-in connector); point to the calm split-status strip — *Legacy: All clear · Trinetra: Monitoring.*

### 1:00 – 1:40 · The split reality *(let it run to ~t8–10, or seek)*
> "Watch what happens. Methane is rising in the battery — but it's still **below** the alarm. Every single sensor reads clear. Then Trinetra does something no sensor can: it connects the rising gas to the active ignition source and the people in the room."

**On screen:** COB-1 turns **red**. The right panel snaps to **COMPOUND HAZARD**, the gauge hits CRITICAL, "**projected breach ~36 min**." The split strip now reads **Legacy: 🟢 All clear** vs **Trinetra: 🔴 Compound alert**, with **+N min** ticking up between them.

### 1:40 – 2:10 · "We've seen this death before"
> "And it recognises it. Trinetra matched these live conditions against a library of real industrial disasters."

**On screen:** the **Disaster Memory** card — **"81% match — Visakhapatnam Steel Plant coke-oven explosion, 8 killed"** — and read one line of the AI briefing. Note the precedents below (Texas City 73%, hot-work ignition 71%).

### 2:10 – 2:40 · The autonomous response
> "Because it's caught early, the system doesn't just alarm — it prepares the full response."

**On screen:** click **"Autonomous response prepared."** The modal opens:
- the **avoided-loss banner** — *"₹115.5 Cr prevented per incident · ~7.7× expected annual ROI even at a conservative 1-in-15-year event"* (lives + asset + downtime + penalty, every figure carries its basis; plus a recurring insurance-premium offset),
- the **evidence timeline** — permit opened → personnel entry → **Trinetra alert (T+8)** → **legacy alarm (T+14)**: the six-minute lead as an auditable sequence,
- the **action checklist** (suspend hot-work, evacuate, page response team, preserve evidence),
- the **evacuation alert** — toggle **Telugu** and **Hindi** ("in the languages the workers on that floor actually speak"),
- the **auto-drafted incident report** citing **Factory Act §36/37/38** and **OISD-STD-105**.

### 2:40 – 3:10 · The proof + close
> "On a 28-scenario benchmark — including the hardest cases, where rising gas, a hot-work permit and a crew are all present but the zone is inerted and physically can't ignite — Trinetra caught every real compound hazard with **zero** false alarms, an average of **seven minutes** before the legacy system. On the Vizag reconstruction: **six minutes** of warning, while every gas sensor still read green. And the real differentiator isn't the lead — any trend alarm buys you the seven minutes — it's precision: strip the context out and that same rule fires a nuisance alert **71%** of the time. The fusion is what takes that to **zero**."
>
> "Three workers die every day in India's factories — and that's just the ones we count. The data to stop it already exists. Six minutes is the difference between an evacuation and a funeral — and **Trinetra is the layer that acts on it: before, not after.**"

*(Optional interactive beats, if time / for live Q&A: hit **`custom`** and toggle ignition off → the compound alert vanishes, on → it returns. Or hit the **connector** and upload a SCADA CSV — the same engine replays real data.)*

**On screen:** cut to the architecture diagram / the metrics line. End on the Trinetra mark.

---

## One-line pitch (for Q&A / the elevator version)
*"Trinetra is the missing intelligence layer that fuses gas sensors, permits, CCTV and shift logs to catch the lethal combinations no single sensor flags — giving safety officers minutes of warning before a fatality, not a report after one."*

## Likely judge questions — crisp answers
- **"Is this real data?"** → A digital twin in the demo, but it ingests standard SCADA/IoT/permit formats — real-plant integration is a connector, not a rewrite. *Prove it live:* upload a SCADA CSV through the connector and the same engine runs on it unchanged.
- **"Would it have caught a *real* one?"** → Two of them, same engine, no tuning. Hit **Texas City · CSB**: it replays the U.S. CSB's documented BP Texas City (2005) escalation (Report 2005-04-I-TX) and raises the compound alert **10 minutes before the vapour-cloud ignition the CSB recorded**. Then **Jaipur · MB Lal**: the Indian Oil Jaipur (2009) depot fire — **36 minutes** before the documented ignition of a long, undetected vapour build-up. Honest mapping — neither site had a working gas detector (a finding in both inquiries), so the documented vapour escalation is mapped onto our flammable channel; the ignition timing and the personnel are the inquiry's.
- **"How is this not just another alarm?"** → It fires on the *combination below* single-sensor thresholds, and it's measured: 100% recall / 0% false-positive / +7.4 min lead vs the baseline. The ablation shows context cuts nuisance alarms from 67% to 0% at the same lead time.
- **"Why won't it cry wolf?"** → 15 hard-negative scenarios — including the toughest, where rising gas, a hot-work permit and crew are ALL present but the zone is inerted (no oxidizer to burn), which a "three boxes ticked" rule gets wrong — at 0% false compound alerts. Plus ten fault-mode checks (stuck sensor, noise spike, delayed permit, faulty-low / transient / cold-start O2, missing CCTV) in `test_robustness.py`.
- **"What's the ROI / business case?"** → One prevented Vizag-class incident ≈ **₹115.5 Cr** avoided (lives + asset + downtime + penalty). On expected value — even at a conservative **1-in-15-year** event probability — that's a **~7.7× annual return** on the ~₹1 Cr/yr platform (still **~3.9×** at 1-in-30); plus a recurring **insurance-premium reduction** (5–15% for continuous monitoring) that offsets the platform cost regardless of any incident.
- **"What if the AI is rate-limited mid-demo?"** → It degrades to vetted cached analysis (UI badges "cached"); the precedent match is still real (embeddings) and the room stays fully functional.
- **"Who buys it?"** → Steel, refining, petrochemical, mining — anyone running OISD/Factory-Act permit-to-work. It sits over their existing sensors.

## Booth / attract mode (unattended floor demo)
For the Phase-3 stand, hit **Booth** (top bar) and step away. It runs a ~60-second loop on its own — Vizag compound detection → the Texas City real-incident replay → the fleet board → cross-zone blast radius → a silent hard negative — and on each compound hazard it sounds a **siren and a spoken evacuation**. The **mute** toggle beside it silences the audio for a quiet room; click **Booth** again to take back manual control. It pulls a crowd in without anyone driving.
