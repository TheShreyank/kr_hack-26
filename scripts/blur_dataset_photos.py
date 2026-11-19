#!/usr/bin/env python3
import os
import shutil
from PIL import Image, ImageDraw, ImageFilter

SURGICAL_BOXES = {
    "CM-KA-001": [
        ("face", [515, 220, 610, 325]),
        ("face", [475, 442, 540, 525]),
        ("face", [510, 555, 588, 655]),
        ("face", [458, 718, 512, 782]),
        ("face", [462, 800, 518, 862]),
        ("face", [558, 725, 658, 845]),
        ("face", [595, 922, 738, 1000])
    ],
    "CM-KA-002": [],
    "CM-KA-004": [
        ("face", [395, 355, 458, 405]),
        ("face", [355, 696, 422, 746])
    ],
    "CM-KA-005": [],
    "CM-KA-006": [
        ("plate", [574, 441, 598, 472]),
        ("plate", [748, 620, 806, 696]),
        ("plate", [824, 713, 898, 798]),
        ("plate", [454, 892, 470, 910])
    ],
    "CM-KA-007": [],
    "CM-KA-008": [
        ("face", [636, 894, 658, 912]),
        ("plate", [728, 344, 742, 365]),
        ("plate", [718, 476, 730, 490]),
        ("plate", [722, 624, 735, 638])
    ],
    "CM-KA-011": [
        ("plate", [948, 388, 964, 418]),
        ("face", [945, 554, 998, 596]),
        ("face", [888, 138, 915, 156])
    ],
    "CM-KA-012": [],
    "CM-KA-014": [
        ("plate", [480, 232, 574, 302]),
        ("plate", [656, 594, 710, 634])
    ],
    "CM-KA-018": [
        ("plate", [968, 82, 1000, 110]),
        ("plate", [902, 137, 926, 153]),
        ("plate", [856, 307, 876, 325]),
        ("plate", [798, 392, 816, 405]),
        ("plate", [808, 837, 828, 855]),
        ("plate", [812, 769, 830, 783])
    ],
    "CM-KA-019": [],
    "CM-KA-023": [],
    "CM-KA-024": []
}


def blur_photos():
    os.makedirs("public/photos", exist_ok=True)
    os.makedirs("dataset/photos", exist_ok=True)

    for cid, regions in SURGICAL_BOXES.items():
        orig_path = os.path.join("public/photos_orig", f"{cid}.jpg")
        out_pub = os.path.join("public/photos", f"{cid}.jpg")
        out_ds = os.path.join("dataset/photos", f"{cid}.jpg")

        if not os.path.exists(orig_path):
            continue

        if not regions:
            shutil.copy2(orig_path, out_pub)
            shutil.copy2(orig_path, out_ds)
            print(f"{cid}: clean original preserved")
            continue

        pil_img = Image.open(orig_path).convert("RGB")
        w, h = pil_img.size

        for kind, (ymin, xmin, ymax, xmax) in regions:
            x1 = max(0, int((xmin / 1000.0) * w) - 4)
            y1 = max(0, int((ymin / 1000.0) * h) - 4)
            x2 = min(w, int((xmax / 1000.0) * w) + 4)
            y2 = min(h, int((ymax / 1000.0) * h) + 4)
            bw, bh = x2 - x1, y2 - y1
            if bw <= 2 or bh <= 2:
                continue

            crop = pil_img.crop((x1, y1, x2, y2))
            blurred = crop.filter(ImageFilter.GaussianBlur(radius=22))

            mask = Image.new("L", (bw, bh), 0)
            draw = ImageDraw.Draw(mask)
            if kind == "face":
                draw.ellipse([0, 0, bw, bh], fill=255)
            else:
                draw.rounded_rectangle([0, 0, bw, bh], radius=6, fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(radius=3))

            pil_img.paste(blurred, (x1, y1), mask)

        pil_img.save(out_pub, "JPEG", quality=90)
        shutil.copy2(out_pub, out_ds)
        print(f"{cid}: blurred {len(regions)} regions")


if __name__ == "__main__":
    blur_photos()
