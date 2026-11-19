#!/usr/bin/env python3
"""
Chitra-Maathu Submission Packager
Modalapada 2.0 · Problem 3 (Ramaiah Institute of Technology)

Creates a clean submission ZIP containing:
- dataset/photos/ (JPEG, >= 1280px, blurred faces & number plates)
- dataset/audio/ (15-30s spoken Kannada audio)
- dataset/captions/ (.txt clean Kannada captions)
- dataset/metadata.csv (one row per triplet)
- dataset/consent_forms/speaker_consent_form.md
- README.md
"""

import os
import zipfile

def package_submission():
    zip_filename = "Chitra_Maathu_Modalapada2_Submission.zip"
    print(f"Packaging official submission into '{zip_filename}'...")

    dataset_dir = "dataset"
    include_paths = [
        "README.md",
        os.path.join(dataset_dir, "metadata.csv"),
        os.path.join(dataset_dir, "consent_forms", "speaker_consent_form.md"),
    ]

    # Include all subfolders in dataset
    subfolders = ["photos", "audio", "captions"]

    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        # Add root files
        for p in include_paths:
            if os.path.exists(p):
                zipf.write(p, arcname=p)
                print(f"  Added {p}")

        # Add subfolder items
        for sub in subfolders:
            folder_path = os.path.join(dataset_dir, sub)
            if not os.path.exists(folder_path):
                continue
            count = 0
            for root, _, files in os.walk(folder_path):
                for f in files:
                    file_full = os.path.join(root, f)
                    arc_name = os.path.relpath(file_full, ".")
                    zipf.write(file_full, arcname=arc_name)
                    count += 1
            print(f"  Added {count} files from {folder_path}/")

    size_mb = os.path.getsize(zip_filename) / (1024 * 1024)
    print(f"\n✓ Successfully packaged '{zip_filename}' ({size_mb:.2f} MB). Ready to submit to judges!")

if __name__ == "__main__":
    package_submission()
