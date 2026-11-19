# ಚಿತ್ರ-ಮಾತು (Chitra-Maathu) | Modalapada 2.0 Kannada Multimodal AI Hackathon

> **Challenge 03 · Chitra-Maathu (`ಚಿತ್ರ-ಮಾತು · ಚಿತ್ರ, ಧ್ವನಿ ಮತ್ತು ವಿವರಣೆ`)**  
> *Pair real photos of Karnataka life with a spoken Kannada description and a written caption, then let people find the right photo by asking for it in Kannada.*

---

## ✨ Key Features

1. **🎙️ Kannada Voice & Semantic Scene Search (`ಧ್ವನಿ ಹುಡುಕಾಟ`)**
   - Speak naturally in Kannada (e.g., *“ಹಳದಿ ಹೂಮಾಲೆ ಇರುವ ಮಳಿಗೆ ತೋರಿಸು”*, *“ಬಿಸಿ ಫಿಲ್ಟರ್ ಕಾಫಿ ಮತ್ತು ಮಸಾಲೆ ದೋಸೆ”*, *“ಹಂಪಿಯ ಕಲ್ಲಿನ ರಥ”*).
   - Captures **16 kHz Mono PCM WAV** audio for **Google Gemini Multimodal Audio Search** (`gemini-2.5-flash`) combined with real-time `kn-IN` Speech Recognition and a local Kannada morphological + synonym retrieval engine.
   - Displays semantic match confidence, highlighted Kannada tags, spoken verbatim transcript, corrected literary Kannada caption (`ಪರಿಷ್ಕೃತ ಪ್ರಮಾಣ ಕನ್ನಡ ವಿವರಣೆ`), English transliteration, and `kn-IN` voice read-aloud.

2. **📸 Dataset Collection Studio & Privacy Blur Tool (`ಡೇಟಾಸೆಟ್ ಸ್ಟುಡಿಯೋ`)**
   - **1280px+ JPEG Normalization & Interactive Privacy Blur Canvas**: Upload any Karnataka photo and drag across identifiable faces or vehicle number plates (`KA 09 M 2026`) to blur them right on the HTML5 canvas before saving.
   - **Native 16 kHz Mono WAV Recorder**: Downsamples and encodes microphone audio strictly into **16,000 Hz Mono 16-bit PCM WAV** (`RIFF/WAVE`).
   - **Gemini Multimodal Auto-Captioning**: Sends the blurred JPEG + 16 kHz WAV recording to Gemini to automatically produce both the verbatim spoken transcript and the grammatically standard UTF-8 Kannada caption.

3. **🗂️ Dataset Specification Validator & Exporter (`ಡೇಟಾಸೆಟ್ ಪರಿಶೀಲನೆ & ರಫ್ತು`)**
   - Strictly enforces the Modalapada 2.0 `#dataset` specification:
     - **Audio**: `16 kHz mono WAV` (16-bit PCM)
     - **Images**: `JPEG, 1280px+`
     - **Text**: `UTF-8 Kannada Unicode` (no legacy ASCII font encodings)
     - **Ethics**: Explicit speaker consent and privacy verification flags
   - One-click export of the UTF-8 JSON dataset manifest ([`dataset/chitra_maathu_dataset_utf8.json`](./dataset/chitra_maathu_dataset_utf8.json)) and `.wav` files.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

Or open with any static server / Vite preview:

```bash
npm run build
npm run preview
```

### Connecting Live Gemini Multimodal AI
- The prototype works immediately out of the box with its built-in **Kannada Linguistic Hybrid Engine**.
- Paste your **Gemini API Key** in the top-right header box and click **Save Key** to enable live **Gemini 2.5 Flash** multimodal audio-to-image retrieval and vision+audio auto-captioning.

---

## 📁 Project Structure

```text
├── index.html                              # Main application shell (UTF-8 Kannada)
├── package.json                            # Vite scripts & dependencies
├── dataset/
│   └── chitra_maathu_dataset_utf8.json     # Sample UTF-8 Kannada Multimodal Dataset manifest
└── src/
    ├── main.js                             # Voice search, Privacy Blur canvas, 16kHz recorder UI
    ├── styles.css                          # Karnataka heritage dark UI theme
    ├── data/
    │   └── seedDataset.js                  # Curated Karnataka cultural scenes
    └── utils/
        ├── geminiService.js                # Gemini 2.5 Flash Multimodal Vision+Audio API & fallback
        └── wavEncoder.js                   # 16,000 Hz Mono 16-bit PCM WAV resampler & encoder
```
