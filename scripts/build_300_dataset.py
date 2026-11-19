#!/usr/bin/env python3
import csv
import os
import re
import shutil


def extract_triplets_from_seed_js():
    seed_path = os.path.join("src", "data", "seedDataset.js")
    with open(seed_path, "r", encoding="utf-8") as f:
        text = f.read()

    blocks = re.findall(r'\{\s*id:\s*"(CM-KA-\d+)"(.*?)\n\s*\}', text, re.DOTALL)
    triplets = []

    def get_field(body, name, default=""):
        m = re.search(rf'{name}:\s*"([^"]*)"', body)
        return m.group(1) if m else default

    def get_num(body, name, default=18.0):
        m = re.search(rf'{name}:\s*([\d.]+)', body)
        return float(m.group(1)) if m else default

    for tid, body in blocks:
        triplets.append({
            "triplet_id": tid,
            "place": get_field(body, "region", "ಮೈಸೂರು (Mysuru)"),
            "category": get_field(body, "category", "Streets"),
            "speaker_id": get_field(body, "speaker_id", "SPK-01"),
            "duration_sec": get_num(body, "duration_sec", 18.0),
            "spoken_transcript_kn": get_field(body, "verbatim_audio_transcript_kn"),
            "clean_caption_kn": get_field(body, "corrected_caption_kn")
        })
    return triplets


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


def compute_wer_cer(reference_kn: str, hypothesis_kn: str):
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

    triplets = extract_triplets_from_seed_js()
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

        for item in triplets:
            tid = item["triplet_id"]
            photo_rel = f"photos/{tid}.jpg"
            audio_rel = f"audio/{tid}.mp3"
            caption_rel = f"captions/{tid}.txt"

            caption_full_path = os.path.join("dataset", caption_rel)
            with open(caption_full_path, "w", encoding="utf-8") as cf:
                cf.write(item["clean_caption_kn"] + "\n")

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

    print(f"Synced {len(triplets)} triplets in dataset/captions/, dataset/audio/, and {csv_path}")


if __name__ == "__main__":
    build_submission_folders()
