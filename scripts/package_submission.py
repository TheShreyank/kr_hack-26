#!/usr/bin/env python3
import os
import zipfile


def package_submission():
    zip_filename = "Chitra_Maathu_Modalapada2_Submission.zip"
    print(f"Packaging submission archive: {zip_filename}")

    dataset_dir = "dataset"
    include_paths = [
        "README.md",
        os.path.join(dataset_dir, "metadata.csv"),
        os.path.join(dataset_dir, "consent_forms", "speaker_consent_form.md"),
    ]
    subfolders = ["photos", "audio", "captions"]

    with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
        for p in include_paths:
            if os.path.exists(p):
                zipf.write(p, arcname=p)
                print(f"  Added {p}")

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
    print(f"Created {zip_filename} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    package_submission()
