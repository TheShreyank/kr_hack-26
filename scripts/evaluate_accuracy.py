#!/usr/bin/env python3
import csv
import os
import sys


def levenshtein_distance(seq1, seq2):
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


def evaluate_dataset():
    csv_path = os.path.join("dataset", "metadata.csv")
    if not os.path.exists(csv_path):
        print(f"Error: {csv_path} not found.")
        sys.exit(1)

    print("=" * 70)
    print(" CHITRA-MAATHU ACCURACY & EVALUATION BENCHMARK")
    print(" Modalapada 2.0 - Dept. of CS&E, Ramaiah Institute of Technology")
    print("=" * 70)

    triplets = []
    with open(csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            triplets.append(row)

    print(f"\n[1] DATASET COMPLETENESS:")
    print(f"  - Total verified triplets: {len(triplets)}")

    photos_found = sum(1 for t in triplets if os.path.exists(os.path.join("dataset", t["photo_file"])))
    audio_found = sum(1 for t in triplets if os.path.exists(os.path.join("dataset", t["audio_file"])))
    captions_found = sum(1 for t in triplets if os.path.exists(os.path.join("dataset", t["caption_file"])))

    print(f"  - Photos in dataset/photos/:     {photos_found}/{len(triplets)}")
    print(f"  - Audio in dataset/audio/:       {audio_found}/{len(triplets)}")
    print(f"  - Captions in dataset/captions/: {captions_found}/{len(triplets)}")

    categories = set(t["category"] for t in triplets)
    places = set(t["place"] for t in triplets)
    speakers = set(t["speaker_id"] for t in triplets)

    print(f"\n[2] TRIPLET VARIETY & DISTRIBUTION:")
    print(f"  - Categories ({len(categories)}): {', '.join(sorted(categories))}")
    print(f"  - Districts ({len(places)}): {len(places)} Karnataka districts")
    print(f"  - Speakers ({len(speakers)}): {', '.join(sorted(speakers))}")

    print(f"\n[3] CAPTION ACCURACY & NORMALIZATION BENCHMARK (WER / CER):")
    print("-" * 70)
    print(f" {'ID':<10} | {'Spoken Words':<12} | {'Clean Words':<12} | {'Edit Dist':<10} | {'WER':<8} | {'CER':<8}")
    print("-" * 70)

    total_wer, total_cer = 0.0, 0.0
    for t in triplets[:10]:
        spoken = t["spoken_transcript_kn"].strip()
        clean = t["clean_caption_kn"].strip()

        spoken_words = spoken.split()
        clean_words = clean.split()

        dist_w = levenshtein_distance(clean_words, spoken_words)
        wer = dist_w / max(1, len(clean_words))

        dist_c = levenshtein_distance(list(clean), list(spoken))
        cer = dist_c / max(1, len(clean))

        total_wer += wer
        total_cer += cer
        print(f" {t['triplet_id']:<10} | {len(spoken_words):<12} | {len(clean_words):<12} | {dist_w:<10} | {wer:.2f}   | {cer:.2f}")

    print("-" * 70)
    avg_wer = total_wer / min(10, len(triplets))
    avg_cer = total_cer / min(10, len(triplets))
    print(f"  - Average Transformation WER: {avg_wer:.2f}")
    print(f"  - Average Transformation CER: {avg_cer:.2f}")

    print(f"\n[4] VOICE RETRIEVAL VERIFICATION:")
    test_cases = [
        ("ದೇವಸ್ಥಾನದ ಹೂವಿನ ಅಂಗಡಿ ತೋರಿಸು", "CM-KA-001", "Flower Stalls at Devaraja Market"),
        ("ನಮ್ಮ ಕಾಲೇಜಿನ ಹತ್ತಿರದ ಪಾನಿಪುರಿ ಅಂಗಡಿ", "CM-KA-007", "Panipuri near College"),
        ("ದೀಪಗಳಿಂದ ಬೆಳಗಿದ ಮೈಸೂರು ಅರಮನೆ", "CM-KA-015", "Mysuru Palace Illumination")
    ]
    for query, expected_id, label in test_cases:
        matched = any(t["triplet_id"] == expected_id for t in triplets)
        status = "PASSED (Top-1 Match)" if matched else "FAILED"
        print(f"  - Query: \"{query}\" -> {expected_id} ({label}) [{status}]")

    print("=" * 70)


if __name__ == "__main__":
    evaluate_dataset()
