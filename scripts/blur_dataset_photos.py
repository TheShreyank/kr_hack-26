#!/usr/bin/env python3
"""
Surgical Face & Number Plate Blurring for Chitra-Maathu Dataset Photos.
Restores clean originals for photos that have no faces or readable number plates
(CM-KA-002, CM-KA-005, CM-KA-007, CM-KA-012, CM-KA-019), and applies tight
feathered Gaussian blurs ONLY to exact visible faces and vehicle number plates.
"""

import os
import shutil
from PIL import Image, ImageDraw, ImageFilter

# Exact, visually verified bounding boxes [ymin, xmin, ymax, xmax] (0-1000 scale)
# Photos with empty list [] have NO identifiable faces or readable number plates and stay 100% unblurred.
SURGICAL_BOXES = {
    "CM-KA-001": [
        # 7 visible faces in Devaraja Market, Mysuru
        ("face", [515, 220, 610, 325]),
        ("face", [475, 442, 540, 525]),
        ("face", [510, 555, 588, 655]),
        ("face", [458, 718, 512, 782]),
        ("face", [462, 800, 518, 862]),
        ("face", [558, 725, 658, 845]),
        ("face", [595, 922, 738, 1000])
    ],
    "CM-KA-002": [],  # Pure Avarebele Dosa close-up — no faces or plates
    "CM-KA-004": [
        # 2 artisans facing forward in Channapatna workshop
        ("face", [395, 355, 458, 405]),
        ("face", [355, 696, 422, 746])
    ],
    "CM-KA-005": [],  # Namma Yatri roof sign close-up — no identifiable faces or readable plates
    "CM-KA-006": [
        # 4 readable vehicle number plates on BMTC bus (KA 57 F 1596) & Autos (KA 05 AB 3961)
        ("plate", [574, 441, 598, 472]),
        ("plate", [748, 620, 806, 696]),
        ("plate", [824, 713, 898, 798]),
        ("plate", [454, 892, 470, 910])
    ],
    "CM-KA-007": [],  # Pure Kach Dabeli snack bowl close-up — no faces or plates
    "CM-KA-008": [
        # Small scooter front plates & pedestrian face at Devaraja Market entrance
        ("face", [636, 894, 658, 912]),
        ("plate", [728, 344, 742, 365]),
        ("plate", [718, 476, 730, 490]),
        ("plate", [722, 624, 735, 638])
    ],
    "CM-KA-011": [
        # Commercial Street white car rear number plate & foreground faces
        ("plate", [948, 388, 964, 418]),
        ("face", [945, 554, 998, 596]),
        ("face", [888, 138, 915, 156])
    ],
    "CM-KA-012": [],  # Pure Badam Milk & Pheni bowls close-up — no faces or plates
    "CM-KA-014": [
        # Two yellow KA 02 B 9275 number plates on the parked auto-rickshaw (front & side)
        ("plate", [480, 232, 574, 302]),
        ("plate", [656, 594, 710, 634])
    ],
    "CM-KA-018": [
        # Rear license plates on parked auto-rickshaws outside Kalaburagi railway station
        ("plate", [968, 82, 1000, 110]),
        ("plate", [902, 137, 926, 153]),
        ("plate", [856, 307, 876, 325]),
        ("plate", [798, 392, 816, 405]),
        ("plate", [808, 837, 828, 855]),
        ("plate", [812, 769, 830, 783])
    ],
    "CM-KA-019": []   # Pure Hotel Swathi building facade — no faces or plates
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
            # Copy clean unblurred original directly
            shutil.copy2(orig_path, out_pub)
            shutil.copy2(orig_path, out_ds)
            print(f"{cid}: 0 faces/plates -> restored 100% clean original")
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

            # Use smooth elliptical mask for faces and rounded mask for number plates
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
        print(f"{cid}: surgically blurred {len(regions)} exact face/plate regions")


if __name__ == "__main__":
    blur_photos()
