#!/usr/bin/env python3
"""
Chitra-Maathu (ಚಿತ್ರ-ಮಾತು) Batch Dataset Builder & WER/CER Evaluator
Modalapada 2.0 · Problem 3 (Dept. of CS&E, Ramaiah Institute of Technology)

Features:
1. Generates/updates the official submission folders:
   - dataset/photos/      (JPEG, 1280px or larger)
   - dataset/audio/       (Spoken Kannada descriptions, 15-30s)
   - dataset/captions/    (UTF-8 Kannada .txt captions, 1 per photo)
   - dataset/metadata.csv (One row per triplet: place, category, speaker_id, etc.)
2. Computes Word Error Rate (WER) and Character Error Rate (CER) for caption accuracy evaluation.
"""

import csv
import json
import os
import shutil

SEED_TRIPLETS = [
    {
        "triplet_id": "CM-KA-001",
        "place": "ಮೈಸೂರು (Mysuru)",
        "category": "Festivals",
        "speaker_id": "SPK-01",
        "duration_sec": 18.5,
        "spoken_transcript_kn": "ಇಲ್ಲಿ ದೇವಸ್ಥಾನದ ಜಾತ್ರೆ ಒಳಗೆ ಹಳದಿ ಸೇವಂತಿಗೆ ಮತ್ತೆ ಚೆಂಡು ಹೂವಿನ ಮಾಲೆಗಳನ್ನ ಅಂಗಡಿಯಲ್ಲಿ ತೂಗು ಹಾಕಿದ್ದಾರೆ.",
        "clean_caption_kn": "ದೇವಸ್ಥಾನದ ಜಾತ್ರೆಯ ಹೂವಿನ ಮಳಿಗೆಯಲ್ಲಿ ಕಟ್ಟಿರುವ ತಾಜಾ ಹಳದಿ ಸೇವಂತಿಗೆ ಮತ್ತು ಮಲ್ಲಿಗೆ ಹೂಮಾಲೆಗಳು."
    },
    {
        "triplet_id": "CM-KA-002",
        "place": "ಬೆಂಗಳೂರು ನಗರ (Bengaluru Urban)",
        "category": "Food",
        "speaker_id": "SPK-03",
        "duration_sec": 19.4,
        "spoken_transcript_kn": "ಬೆಳಗ್ಗೆ ದರ್ಶಿನಿ ಹೋಟೆಲ್‌ನಲ್ಲಿ ಗರಿಗರಿಯಾದ ಮಸಾಲೆ ದೋಸೆ, ಚಟ್ನಿ ಮತ್ತೆ ಲೋಟದಲ್ಲಿ ಬಿಸಿ ಫಿಲ್ಟರ್ ಕಾಫಿ ಇಟ್ಟಿದ್ದಾರೆ.",
        "clean_caption_kn": "ಬೆಂಗಳೂರಿನ ದರ್ಶಿನಿ ಹೋಟೆಲ್‌ನಲ್ಲಿ ಬಡಿಸಲಾದ ಗರಿಗರಿಯಾದ ಮಸಾಲೆ ದೋಸೆ, ತೆಂಗಿನಕಾಯಿ ಚಟ್ನಿ ಮತ್ತು ಬಿಸಿ ಫಿಲ್ಟರ್ ಕಾಫಿ."
    },
    {
        "triplet_id": "CM-KA-003",
        "place": "ವಿಜಯನಗರ (Vijayanagara)",
        "category": "Streets",
        "speaker_id": "SPK-02",
        "duration_sec": 22.1,
        "spoken_transcript_kn": "ಇದು ಹಂಪಿಯೊಳಗಿರೋ ವಿಜಯ ವಿಠ್ಠಲ ದೇವಸ್ಥಾನದ ಮುಂದೆ ಕೆತ್ತಿರೋ ಪ್ರಸಿದ್ಧ ಕಲ್ಲಿನ ರಥ.",
        "clean_caption_kn": "ಹಂಪಿಯ ವಿಜಯ ವಿಠ್ಠಲ ದೇವಾಲಯದ ಆವರಣದಲ್ಲಿರುವ ವಿಜಯನಗರ ಸಾಮ್ರಾಜ್ಯದ ಐತಿಹಾಸಿಕ ಕಲ್ಲಿನ ರಥ."
    },
    {
        "triplet_id": "CM-KA-004",
        "place": "ದಕ್ಷಿಣ ಕನ್ನಡ (Dakshina Kannada)",
        "category": "Festivals",
        "speaker_id": "SPK-04",
        "duration_sec": 20.6,
        "spoken_transcript_kn": "ಯಕ್ಷಗಾನ ಆಟದಲ್ಲಿ ಕಲಾವಿದರು ತಲೆಗೆ ದೊಡ್ಡ ಕಿರೀಟ ಹಾಕೊಂಡು ಮುಖಕ್ಕೆ ಬಣ್ಣ ಹಚ್ಚಿ ಕುಣಿಯುತ್ತಿದ್ದಾರೆ.",
        "clean_caption_kn": "ಸಾಂಪ್ರದಾಯಿಕ ಕಿರೀಟ ಮತ್ತು ವರ್ಣರಂಜಿತ ಮುಖವರ್ಣಿಕೆಯೊಂದಿಗೆ ವೇದಿಕೆಯ ಮೇಲೆ ಅಭಿನಯಿಸುತ್ತಿರುವ ಯಕ್ಷಗಾನ ಕಲಾವಿದ."
    },
    {
        "triplet_id": "CM-KA-005",
        "place": "ರಾಮನಗರ (Ramanagara)",
        "category": "Streets",
        "speaker_id": "SPK-03",
        "duration_sec": 16.8,
        "spoken_transcript_kn": "ಇಲ್ಲಿ ಚನ್ನಪಟ್ಟಣದೊಳಗೆ ಮರದಿಂದ ಮಾಡಿರೋ ಬಣ್ಣ ಬಣ್ಣದ ಗೊಂಬೆಗಳನ್ನ ಸಾಲಾಗಿ ಜೋಡಿಸಿ ಇಟ್ಟಿದ್ದಾರೆ.",
        "clean_caption_kn": "ನೈಸರ್ಗಿಕ ಬಣ್ಣಗಳಿಂದ ತಯಾರಿಸಲಾದ ಚನ್ನಪಟ್ಟಣದ ಸಾಂಪ್ರದಾಯಿಕ ಕರಕುಶಲ ಮರದ ಗೊಂಬೆಗಳು."
    },
    {
        "triplet_id": "CM-KA-006",
        "place": "ಧಾರವಾಡ (Dharwad)",
        "category": "Nature",
        "speaker_id": "SPK-04",
        "duration_sec": 18.9,
        "spoken_transcript_kn": "ಊರಿನ ವಾರದ ಸಂತೆಯಾಗ ತಾಜಾ ಹಸಿರು ತರಕಾರಿ, ಟೊಮೆಟೊ ಮತ್ತೆ ಸೊಪ್ಪು ಮಾರಾಕ ಇಟ್ಟಾರ.",
        "clean_caption_kn": "ವಾರದ ಸಂತೆಯಲ್ಲಿ ರೈತರು ಮಾರಾಟಕ್ಕೆ ಜೋಡಿಸಿಟ್ಟಿರುವ ತಾಜಾ ಹಸಿರು ತರಕಾರಿಗಳು ಮತ್ತು ಸೊಪ್ಪು."
    },
    {
        "triplet_id": "CM-KA-007",
        "place": "ಬೆಂಗಳೂರು ನಗರ (Bengaluru Urban)",
        "category": "Campus",
        "speaker_id": "SPK-02",
        "duration_sec": 17.2,
        "spoken_transcript_kn": "ಇದು... ಹಾ... ನಮ್ಮ ಕಾಲೇಜ್ ಹತ್ರ ಇರೋ ಪಾನಿಪೂರಿ ಅಂಗಡಿ, ಸಂಜೆ ಹುಡುಗರೆಲ್ಲಾ ಇಲ್ಲಿ ಪಾನಿಪೂರಿ ತಿನ್ನೋಕೆ ಬರ್ತಾರೆ.",
        "clean_caption_kn": "ನಮ್ಮ ಕಾಲೇಜಿನ ಹತ್ತಿರದ ರಸ್ತೆಬದಿಯ ಸಂಜೆಯ ಪಾನಿಪೂರಿ ಮತ್ತು ಚಾಟ್ಸ್ ಅಂಗಡಿ."
    },
    {
        "triplet_id": "CM-KA-008",
        "place": "ಮೈಸೂರು (Mysuru)",
        "category": "Festivals",
        "speaker_id": "SPK-01",
        "duration_sec": 21.0,
        "spoken_transcript_kn": "ಇದು ಮೈಸೂರು ಅರಮನೆಯ ದೀಪಾಲಂಕಾರ, ದಸರಾ ಹಬ್ಬದ ಟೈಮಲ್ಲಿ ರಾತ್ರಿ ಇಡೀ ಅರಮನೆ ಲೈಟ್‌ಗಳಿಂದ ಜಗಮಗಿಸುತ್ತೆ.",
        "clean_caption_kn": "ದಸರಾ ಹಬ್ಬದಂದು ಸಾವಿರಾರು ವಿದ್ಯುತ್ ದೀಪಗಳಿಂದ ಬೆಳಗಿದ ಐತಿಹಾಸಿಕ ಮೈಸೂರು ಅರಮನೆ."
    }
]


def levenshtein_distance(seq1, seq2):
    """Calculates Levenshtein edit distance for WER / CER scoring."""
    m, n = len(seq1), len(seq2)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if seq1[i - 1] == seq2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
    return dp[m][n]


def compute_wer_cer(reference_kn: str, hypothesis_kn: str):
    """Computes Word Error Rate (WER) and Character Error Rate (CER) for Kannada text."""
    ref_words = reference_kn.strip().split()
    hyp_words = hypothesis_kn.strip().split()
    wer = levenshtein_distance(ref_words, hyp_words) / max(1, len(ref_words))

    ref_chars = list(reference_kn.strip())
    hyp_chars = list(hypothesis_kn.strip())
    cer = levenshtein_distance(ref_chars, hyp_chars) / max(1, len(ref_chars))
    return round(wer, 4), round(cer, 4)


def build_submission_folders():
    os.makedirs("dataset/photos", exist_ok=True)
    os.makedirs("dataset/audio", exist_ok=True)
    os.makedirs("dataset/captions", exist_ok=True)

    csv_path = "dataset/metadata.csv"
    headers = [
        "triplet_id",
        "photo_file",
        "audio_file",
        "caption_file",
        "place",
        "category",
        "speaker_id",
        "duration_sec",
        "spoken_transcript_kn",
        "clean_caption_kn"
    ]

    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for item in SEED_TRIPLETS:
            tid = item["triplet_id"]
            photo_rel = f"photos/{tid}.jpg"
            audio_rel = f"audio/{tid}.mp3"
            caption_rel = f"captions/{tid}.txt"

            # Write individual Kannada caption .txt file (1 per photo)
            caption_full_path = os.path.join("dataset", caption_rel)
            with open(caption_full_path, "w", encoding="utf-8") as cf:
                cf.write(item["clean_caption_kn"] + "\n")

            # Copy audio from public/audio if available
            pub_audio = os.path.join("public", "audio", f"{tid}.mp3")
            dst_audio = os.path.join("dataset", audio_rel)
            if os.path.exists(pub_audio):
                shutil.copy2(pub_audio, dst_audio)

            writer.writerow([
                tid,
                photo_rel,
                audio_rel,
                caption_rel,
                item["place"],
                item["category"],
                item["speaker_id"],
                item["duration_sec"],
                item["spoken_transcript_kn"],
                item["clean_caption_kn"]
            ])

    print(f"Built {len(SEED_TRIPLETS)} triplets in dataset/captions/, dataset/audio/, and {csv_path}")


if __name__ == "__main__":
    build_submission_folders()
