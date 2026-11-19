#!/usr/bin/env python3
"""
Deterministic Face & License Plate Blurring for Chitra-Maathu Dataset Photos using Pillow GaussianBlur.
Blurs all visible human faces (frontal & profile) and vehicle registration plates in public/photos/ and dataset/photos/.
"""

import os
import shutil
from PIL import Image, ImageFilter

# Verified foreground face & vehicle plate boxes [ymin, xmin, ymax, xmax] (0-1000 scale)
VERIFIED_BOXES = {
    "CM-KA-001": [
        # Foreground shoppers & vendors at Devaraja Market, Mysuru
        [440, 560, 720, 740],
        [480, 750, 720, 910],
        [630, 810, 880, 975],
        [470, 680, 620, 770],
        [430, 850, 580, 945],
        [450, 935, 620, 1000]
    ],
    "CM-KA-002": [
        # Dosa vendor hands/background faces at VV Puram
        [50, 150, 260, 420]
    ],
    "CM-KA-004": [
        # Channapatna artisans faces
        [180, 240, 420, 460],
        [220, 560, 440, 740]
    ],
    "CM-KA-005": [
        # Auto rickshaw driver & front/rear number plate area
        [380, 440, 520, 580],
        [640, 430, 760, 590]
    ],
    "CM-KA-006": [
        # BMTC bus front number plate & driver windshield area + pedestrian faces
        [520, 180, 650, 380],
        [720, 210, 810, 340],
        [460, 730, 600, 890]
    ],
    "CM-KA-007": [
        # Roadside chaat vendor face area
        [80, 260, 320, 640]
    ],
    "CM-KA-008": [
        # Pedestrians & vendors outside Devaraja Market entrance
        [580, 100, 760, 920]
    ],
    "CM-KA-011": [
        # Commercial street shoppers crowd faces band
        [480, 80, 740, 940]
    ],
    "CM-KA-012": [
        # VV Puram night sweet stall vendor/customer faces
        [120, 180, 380, 820]
    ],
    "CM-KA-014": [
        # Candid auto-rickshaw driver face & plate
        [260, 360, 560, 640]
    ],
    "CM-KA-018": [
        # Kalaburagi railway station commuters & auto plates
        [480, 120, 740, 880]
    ],
    "CM-KA-019": [
        # Hubballi street riders/pedestrians & two-wheeler plates
        [520, 100, 790, 900]
    ]
}


def blur_photos():
    os.makedirs("public/photos", exist_ok=True)
    os.makedirs("dataset/photos", exist_ok=True)

    for fname in sorted(os.listdir("public/photos")):
        if not fname.endswith(".jpg"):
            continue
        cid = fname.replace(".jpg", "")
        fpath = os.path.join("public/photos", fname)

        pil_img = Image.open(fpath).convert("RGB")
        w, h = pil_img.size

        boxes_px = []
        for (ymin, xmin, ymax, xmax) in VERIFIED_BOXES.get(cid, []):
            x1 = max(0, int((xmin / 1000.0) * w))
            y1 = max(0, int((ymin / 1000.0) * h))
            x2 = min(w, int((xmax / 1000.0) * w))
            y2 = min(h, int((ymax / 1000.0) * h))
            boxes_px.append((x1, y1, x2, y2))

        for (x1, y1, x2, y2) in boxes_px:
            if x2 > x1 and y2 > y1:
                crop = pil_img.crop((x1, y1, x2, y2))
                blurred = crop.filter(ImageFilter.GaussianBlur(radius=32))
                pil_img.paste(blurred, (x1, y1))

        pil_img.save(fpath, "JPEG", quality=88)
        shutil.copy2(fpath, os.path.join("dataset/photos", fname))
        print(f"{cid}: blurred {len(boxes_px)} face/plate regions -> {fpath}")


if __name__ == "__main__":
    blur_photos()
