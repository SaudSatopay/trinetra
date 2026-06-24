"""Fetch + precompute the CCTV demo feed (run once; safe to re-run).

The control-room "CCTV - YOLOv8" tile can replay a REAL recorded clip through the same YOLOv8 person +
restricted-zone detector, as a looping feed (GET /api/vision/feed). The footage is third-party stock,
so we do NOT commit it to the repo (its free license permits use in this project but not redistribution
of the standalone file). This script downloads the clip locally and precomputes the annotated detection
frames into backend/app/data/cctv/feed.json (both gitignored). Source + license: app/data/cctv/SOURCE.md.

    python scripts/fetch_cctv.py        # from the repo root, with the backend venv active
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # trinetra/
BACKEND = ROOT / "backend"
DATA = BACKEND / "app" / "data" / "cctv"
CLIP = DATA / "warehouse_23237.mp4"
CACHE = DATA / "feed.json"

CLIP_URL = "https://assets.mixkit.co/videos/23237/23237-720.mp4"
SOURCE = ("Mixkit - 'Business people walking in the warehouse' (clip 23237), "
          "https://mixkit.co/free-stock-video/business-people-walking-in-the-warehouse-23237/")
LICENSE = "Mixkit Free License - free for commercial and non-commercial use, no attribution required"


def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    if not CLIP.exists():
        print(f"downloading clip -> {CLIP}")
        req = urllib.request.Request(CLIP_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=180) as r, open(CLIP, "wb") as f:
            f.write(r.read())
    print(f"clip: {CLIP} ({CLIP.stat().st_size:,} bytes)")

    # run from the backend dir so YOLO finds/caches its weights consistently
    os.chdir(BACKEND)
    sys.path.insert(0, str(BACKEND))
    from app.vision.detector import process_clip

    print("running YOLOv8 over the clip (this takes ~30-60s on CPU) ...")
    frames = process_clip(str(CLIP), n_frames=28)
    CACHE.write_text(json.dumps({"source": SOURCE, "license": LICENSE,
                                 "count": len(frames), "frames": frames}), encoding="utf-8")
    persons = [f["persons"] for f in frames]
    print(f"wrote {CACHE} - {len(frames)} frames, persons/frame {min(persons)}-{max(persons)}")


if __name__ == "__main__":
    main()
