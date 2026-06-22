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
