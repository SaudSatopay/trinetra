"""Smoke test: YOLOv8 person detection + restricted-zone intrusion on a sample frame."""
from app.vision.detector import detect, sample_frame, zone_intrusion


def main():
    frame = sample_frame()
    det = detect(frame)
    print(f"frame              : {frame}")
    print(f"persons detected   : {det['persons']}")
    print(f"restricted-zone intruders : {zone_intrusion(det)}")
    if det["boxes"]:
        print(f"top detection      : {det['boxes'][0]}")


if __name__ == "__main__":
    main()
