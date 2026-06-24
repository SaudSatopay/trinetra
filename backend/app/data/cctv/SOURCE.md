# CCTV demo feed — source & license

The control‑room **"CCTV · YOLOv8"** tile can replay a **real recorded clip** through the same YOLOv8
person + restricted‑zone detector, as a looping feed (`GET /api/vision/feed`). Real footage, real
per‑frame inference.

The footage is **third‑party stock and is not committed** to this repo — its license permits use in
this project but not redistribution of the standalone file. To enable the live feed locally:

```
python scripts/fetch_cctv.py      # from the repo root, backend venv active
```

That downloads the clip and precomputes the annotated detection frames into `feed.json` (both
gitignored). Without it, the tile falls back to the always‑available single‑frame `/api/vision` sample.

| | |
|---|---|
| **Clip** | "Business people walking in the warehouse" — Mixkit clip **23237** ([page](https://mixkit.co/free-stock-video/business-people-walking-in-the-warehouse-23237/)) |
| **License** | **Mixkit Free License** — free for commercial & non‑commercial use, no attribution required, no watermark. (Not redistributed here as a standalone file; used as a demo asset.) |
| **Detection** | pretrained **YOLOv8n** (COCO, person class) — real per‑frame inference; the restricted‑zone overlay + intrusion count come from `app/vision/detector.process_clip`. |

This is a **recorded sample** feed; a live RTSP/ONVIF camera is the same connector with the source
swapped — the detector and the compound‑risk wiring are unchanged.
