"""YOLOv8 CCTV vision - worker detection + restricted-zone intrusion.

Pretrained YOLOv8 (COCO) detects people in a CCTV frame; we count them and flag
intrusion into a restricted region. This is the computer-vision modality that
feeds the Vision agent (personnel presence) in the compound-risk graph -
the same signal that, combined with rising gas and an active hot-work permit,
makes the compound hazard. PPE / hard-hat detection is a fine-tune away on the
identical pipeline.

The model + torch are heavy, so they load lazily and cache.
"""
from __future__ import annotations

import base64
from functools import lru_cache


@lru_cache(maxsize=1)
def _model():
    from ultralytics import YOLO

    return YOLO("yolov8n.pt")  # auto-downloads ~6 MB weights on first call


def sample_frame() -> str:
    """A bundled CCTV-like frame with several people (stand-in for a plant camera)."""
    from ultralytics.utils import ASSETS

    return str(ASSETS / "bus.jpg")


def detect(image_path: str, conf: float = 0.35) -> dict:
    """Detect people in a frame. Returns counts + boxes."""
    res = _model()(image_path, conf=conf, classes=[0], verbose=False)[0]  # class 0 = person
    boxes = []
    for b in res.boxes:
        x1, y1, x2, y2 = (round(float(v), 1) for v in b.xyxy[0].tolist())
        boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "conf": round(float(b.conf[0]), 3)})
    h, w = res.orig_shape
    return {"width": int(w), "height": int(h), "persons": len(boxes), "boxes": boxes}


def zone_intrusion(det: dict, region=(0.0, 0.35, 0.55, 1.0)) -> int:
    """Count persons whose box-centre falls inside a restricted region (normalised coords)."""
    w, h = det["width"], det["height"]
    rx1, ry1, rx2, ry2 = region[0] * w, region[1] * h, region[2] * w, region[3] * h
    n = 0
    for b in det["boxes"]:
        cx, cy = (b["x1"] + b["x2"]) / 2, (b["y1"] + b["y2"]) / 2
        if rx1 <= cx <= rx2 and ry1 <= cy <= ry2:
            n += 1
    return n


def annotated_jpeg_b64(image_path: str, conf: float = 0.35) -> str:
    """Base64 JPEG of the frame with detection boxes drawn (for the dashboard CCTV tile)."""
    import cv2

    res = _model()(image_path, conf=conf, classes=[0], verbose=False)[0]
    img = res.plot()  # BGR ndarray with boxes + labels
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buf.tobytes()).decode("ascii") if ok else ""


# the overlaid "restricted zone" on the CCTV feed (normalised x1,y1,x2,y2) — a left-of-frame strip
RESTRICTED_REGION = (0.0, 0.16, 0.40, 1.0)


def process_clip(path: str, n_frames: int = 28, conf: float = 0.35, max_w: int = 640,
                 region=RESTRICTED_REGION) -> list[dict]:
    """Replay a real recorded clip as a CCTV feed: sample n_frames evenly across the video, run the
    SAME YOLOv8 person detector on each, draw the person boxes + a restricted-zone overlay, and return
    downscaled annotated JPEG frames (b64) with the per-frame person + zone-intrusion counts. Real
    footage, real per-frame inference — precomputed once (scripts/fetch_cctv.py) so the demo is snappy."""
    import cv2

    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    if total <= 0:
        cap.release()
        raise RuntimeError(f"could not read video frames: {path}")
    model = _model()
    frames: list[dict] = []
    for fi in (int(i * total / n_frames) for i in range(n_frames)):
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ok, frame = cap.read()
        if not ok:
            continue
        res = model(frame, conf=conf, classes=[0], verbose=False)[0]
        h, w = res.orig_shape
        rx1, ry1, rx2, ry2 = (int(region[0] * w), int(region[1] * h), int(region[2] * w), int(region[3] * h))
        intruders = sum(
            1 for b in res.boxes
            if rx1 <= (b.xyxy[0][0] + b.xyxy[0][2]) / 2 <= rx2 and ry1 <= (b.xyxy[0][1] + b.xyxy[0][3]) / 2 <= ry2
        )
        img = res.plot()  # BGR + person boxes/labels
        cv2.rectangle(img, (rx1, ry1), (rx2, ry2), (43, 144, 245), 2)  # amber = restricted zone
        cv2.putText(img, "RESTRICTED", (rx1 + 6, ry1 + 24), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (43, 144, 245), 2)
        if max_w and w > max_w:
            img = cv2.resize(img, (max_w, int(h * max_w / w)), interpolation=cv2.INTER_AREA)
        ok2, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 72])
        if ok2:
            frames.append({"persons": int(len(res.boxes)), "intruders": int(intruders),
                           "image_b64": base64.b64encode(buf.tobytes()).decode("ascii")})
    cap.release()
    return frames
