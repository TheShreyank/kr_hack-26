# ಚಿತ್ರ-ಮಾತು (Chitra-Maathu) — Picture, Voice & Caption

**Modalapada 2.0 (ಮೊದಲಪದ - II) · Kannada Multimodal AI Hackathon**  
**Department of Computer Science & Engineering, Ramaiah Institute of Technology (MSRIT), Bengaluru**  
**Problem Statement 3:** Chitra-Maathu (`ಚಿತ್ರ-ಮಾತು`)

---

## Abstract

**Chitra-Maathu** is a Kannada multimodal data collection studio and voice-to-image retrieval system built for documenting everyday life across Karnataka. The platform pairs high-resolution photographs (`JPEG, 1280px+`) with 15–30 second spoken Kannada descriptions (`16 kHz mono WAV` / audio) and normalized literary standard Kannada captions (`ಪ್ರಮಾಣ ಕನ್ನಡ ವಿವರಣೆ`), enabling users to retrieve relevant photographs through natural spoken Kannada queries.

### System Pipeline

```text
+---------------+     +----------------------+     +-----------------+     +-------------------+     +--------------------+
|   1. Photo    | --> | 2. Speak in Kannada  | --> | 3. Kannada ASR  | --> |    4. Caption     | --> |  5. Voice Search   |
| (1280px+ JPG) |     |  (15-30s Audio WAV)  |     | (kn-IN Speech)  |     |  (ಪ್ರಮಾಣ ಕನ್ನಡ)   |     |  (ಧ್ವನಿ ಹುಡುಕಾಟ)   |
+---------------+     +----------------------+     +-----------------+     +-------------------+     +--------------------+
```

---

## Core Capabilities

1. **Kannada Voice-to-Photo Retrieval (`ಕನ್ನಡ ಧ್ವನಿ ಹುಡುಕಾಟ`)**
   - Supports continuous spoken Kannada queries (`kn-IN` Web Speech API + 16 kHz PCM WAV multimodal audio analysis).
   - Combines multimodal LLM ranking with an offline Kannada morphological stemmer and domain synonym graph so queries work reliably both online and offline.
2. **Multimodal Triplet Ingestion & Editing Studio**
   - Normalizes uploaded images to `1280px+` JPEG resolution.
   - Records 15–30 second spoken descriptions directly in browser memory and encodes them into `16,000 Hz Mono 16-bit PCM WAV`.
   - Transforms colloquial regional speech (containing hesitations, fillers, and dialect variations) into multi-sentence literary Kannada captions.
   - Allows full editing and deletion of existing triplets.
3. **Automated & Manual Privacy Protection**
   - Uses vision bounding-box detection with high-confidence filtering to locate and apply Gaussian blur strictly to identifiable human faces and readable vehicle registration plates while leaving architecture, food, and landscapes untouched.
   - Includes an interactive canvas brush and one-click undo for manual privacy refinement.

---

## Reference Test Cases

| Case | Spoken Input (Kannada) | Normalized Output / Retrieved Scene | Triplet ID |
| :--- | :--- | :--- | :--- |
| **Photo 1** | *"ಇದು... ಹ್ಞಾ... ನಮ್ಮ ಕಾಲೇಜ್ ಹತ್ರ ಇರೋ ಪಾನಿಪೂರಿ ಅಂಗಡಿ"* | **ನಮ್ಮ ಕಾಲೇಜಿನ ಹತ್ತಿರದ ಪಾನಿಪುರಿ ಅಂಗಡಿ** | `CM-KA-007` |
| **Photo 2** | *"ಇದು ಮೈಸೂರು ಅರಮನೆಯ ದೀಪಾಲಂಕಾರ"* | **ದೀಪಗಳಿಂದ ಬೆಳಗಿದ ಮೈಸೂರು ಅರಮನೆ** | `CM-KA-015` |
| **Search** | *"ದೇವಸ್ಥಾನದ ಹೂವಿನ ಅಂಗಡಿ ತೋರಿಸು"* | **Top Result:** Devaraja Market Flower Stalls, Mysuru | `CM-KA-001` |

---

## Repository & Dataset Deliverables

```text
├── index.html                                  # Application entry point
├── package.json                                # Build configuration and dependencies
├── dataset/
│   ├── metadata.csv                            # Master manifest (one row per triplet)
│   ├── photos/                                 # 1280px+ JPEG images (faces & number plates blurred)
│   ├── audio/                                  # 15-30s spoken Kannada descriptions
│   ├── captions/                               # UTF-8 literary Kannada .txt captions (1 per photo)
│   └── consent_forms/
│       └── speaker_consent_form.md             # Bilateral Kannada & English consent declarations
├── src/
│   ├── main.js                                 # UI controller, 16kHz recorder, privacy canvas
│   ├── styles.css                              # Application styling (4-column responsive grid)
│   ├── data/
│   │   └── seedDataset.js                      # 82 curated Karnataka scene triplets across all 31 districts
│   └── utils/
│       ├── geminiService.js                    # Multimodal ASR, caption normalization, face/plate detector
│       └── wavEncoder.js                       # 16,000 Hz Mono 16-bit PCM WAV resampler & encoder
└── scripts/
    ├── build_300_dataset.py                    # Syncs captions, audio, and metadata.csv
    ├── blur_dataset_photos.py                  # Applies surgical Gaussian blur to faces & license plates
    ├── evaluate_accuracy.py                    # Computes WER / CER and retrieval accuracy
    └── package_submission.py                   # Packages official deliverables into a submission ZIP
```

### Metadata Schema (`dataset/metadata.csv`)

Each row represents a complete triplet with the following columns:
`triplet_id, photo_file, audio_file, caption_file, place, category, speaker_id, duration_sec, spoken_transcript_kn, clean_caption_kn`

---

## Dataset Coverage & Evaluation

### 1. Geographic & Category Distribution
- **Total Verified Triplets:** 82 triplets (`82` photos ≥ 1280px JPEG, `82` spoken Kannada audio files, `82` literary Kannada `.txt` captions).
- **Categories (5):** `Streets` (`ರಸ್ತೆಗಳು`), `Food` (`ಆಹಾರ`), `Festivals` (`ಹಬ್ಬ-ಜಾತ್ರೆ`), `Nature` (`ಪ್ರಕೃತಿ`), `Building` (`ಕಟ್ಟಡಗಳು`).
- **Districts Covered (All 31 Districts of Karnataka):**
  - **Southern & Old Mysuru:** Bengaluru Urban, Bengaluru Rural, Mysuru, Mandya, Ramanagara, Chamarajanagar, Hassan, Tumakuru, Kolar, Chikkaballapura.
  - **Malenadu & Central:** Shivamogga, Chikkamagaluru, Kodagu, Davanagere, Chitradurga.
  - **Coastal (Karavali):** Dakshina Kannada (Mangaluru), Udupi (Manipal / Malpe), Uttara Kannada (Karwar / Gokarna / Murudeshwara / Dandeli).
  - **Kittur & Kalyana Karnataka (North):** Dharwad (Hubballi), Belagavi, Bagalkot, Vijayapura (Bijapur), Gadag, Haveri, Kalaburagi, Bidar, Ballari, Vijayanagara (Hampi / Hosapete), Koppal, Raichur, Yadgir.

### 2. Caption Accuracy (WER / CER) & Voice-Search Relevance
Run the evaluation benchmark to verify dataset integrity, Levenshtein Word Error Rate (WER), Character Error Rate (CER), and Top-1 retrieval accuracy:

```bash
python scripts/evaluate_accuracy.py
```

---

## Local Setup & Execution

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)

### 1. Run the Web Application
```bash
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

*(Optional)* To enable live Gemini multimodal vision and audio auto-captioning for newly uploaded photos, create a `.env.local` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_api_key_here
```

### 2. Build for Production
```bash
npm run build
npm run preview
```

### 3. Package Submission Archive
```bash
python scripts/package_submission.py
```
Generates `Chitra_Maathu_Modalapada2_Submission.zip` containing `dataset/photos/`, `dataset/audio/`, `dataset/captions/`, `dataset/metadata.csv`, `dataset/consent_forms/`, and `README.md`.

---

## Speaker Registry & Ethical Compliance

All recordings and photographs adhere to the privacy and ethics guidelines of Modalapada 2.0:
- Identifiable faces and vehicle registration plates are blurred prior to publication.
- Audio descriptions contain zero personally identifiable information (PII).
- Speaker dialect registry (`SPK-01` Old Mysuru, `SPK-02` Bengaluru Urban, `SPK-03` North Karnataka, `SPK-04` Coastal Karnataka) and signed consent forms are archived in [`dataset/consent_forms/speaker_consent_form.md`](./dataset/consent_forms/speaker_consent_form.md).
