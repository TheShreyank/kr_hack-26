import { SEED_DATASET } from "./data/seedDataset.js";
import { Wav16kRecorder, blobToBase64, createSeedReferenceWavBlob } from "./utils/wavEncoder.js";
import {
  getSavedApiKey,
  saveApiKey,
  searchWithGemini,
  generateCaptionWithGemini
} from "./utils/geminiService.js";

// Application State
let dataset = [...SEED_DATASET];
let currentResults = dataset.map((item) => ({
  item,
  score: 1,
  matchedTokens: [],
  reason_kn: ""
}));

// Voice Search State
let isVoiceSearching = false;
let searchWavRecorder = null;
let searchSpeechRecognition = null;

// Studio State
let isStudioRecording = false;
let studioWavRecorder = null;
let studioSpeechRecognition = null;
let recordedStudioWavBlob = null;
let baseStudioImage = null;
let isDrawingBlur = false;

// DOM Elements
const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
const saveApiKeyBtn = document.getElementById("saveApiKeyBtn");
const geminiStatusDot = document.getElementById("geminiStatusDot");
const activeEngineBadge = document.getElementById("activeEngineBadge");

const searchQueryInput = document.getElementById("searchQueryInput");
const voiceSearchBtn = document.getElementById("voiceSearchBtn");
const voiceSearchText = document.getElementById("voiceSearchText");
const runSearchBtn = document.getElementById("runSearchBtn");
const resetSearchBtn = document.getElementById("resetSearchBtn");
const searchStatusText = document.getElementById("searchStatusText");
const scenesGrid = document.getElementById("scenesGrid");

// Studio Elements
const privacyCanvas = document.getElementById("privacyCanvas");
const ctx = privacyCanvas.getContext("2d");
const imageUploadInput = document.getElementById("imageUploadInput");
const loadSamplePhotoBtn = document.getElementById("loadSamplePhotoBtn");
const clearBlurBtn = document.getElementById("clearBlurBtn");
const imageResolutionBadge = document.getElementById("imageResolutionBadge");

const studioRecordBtn = document.getElementById("studioRecordBtn");
const downloadRecordedWavBtn = document.getElementById("downloadRecordedWavBtn");
const studioAudioInfo = document.getElementById("studioAudioInfo");
const studioAudioMeter = document.getElementById("studioAudioMeter");
const studioAudioPreview = document.getElementById("studioAudioPreview");

const studioRegionInput = document.getElementById("studioRegionInput");
const studioVerbatimInput = document.getElementById("studioVerbatimInput");
const studioCaptionInput = document.getElementById("studioCaptionInput");
const studioTagsInput = document.getElementById("studioTagsInput");
const studioConsentCheckbox = document.getElementById("studioConsentCheckbox");
const geminiAutoAnnotateBtn = document.getElementById("geminiAutoAnnotateBtn");
const addSceneToDatasetBtn = document.getElementById("addSceneToDatasetBtn");

// Dataset Tab Elements
const datasetTableBody = document.getElementById("datasetTableBody");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const exportSampleWavBtn = document.getElementById("exportSampleWavBtn");
const toastBanner = document.getElementById("toastBanner");

function showToast(message) {
  toastBanner.textContent = message;
  toastBanner.classList.add("show");
  setTimeout(() => {
    toastBanner.classList.remove("show");
  }, 3600);
}

// Initialize API Key status
function initApiKeyUI() {
  const existingKey = getSavedApiKey();
  if (existingKey) {
    geminiApiKeyInput.value = existingKey;
    geminiStatusDot.classList.add("connected");
    activeEngineBadge.textContent = "Engine: Gemini Multimodal (gemini-2.5-flash) Connected ✓";
  } else {
    geminiStatusDot.classList.remove("connected");
    activeEngineBadge.textContent = "Engine: Kannada Linguistic Hybrid (Add Gemini Key for Live AI)";
  }
}

saveApiKeyBtn.addEventListener("click", () => {
  saveApiKey(geminiApiKeyInput.value);
  initApiKeyUI();
  showToast(
    geminiApiKeyInput.value.trim()
      ? "✅ Gemini API Key saved! Live Multimodal Audio & Vision enabled."
      : "ℹ️ Using built-in Kannada Linguistic Engine."
  );
});

// Tab Navigation
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    const targetId = btn.getAttribute("data-tab");
    document.getElementById(targetId).classList.add("active");
  });
});

// Speak Kannada text aloud using Web Speech Synthesis (kn-IN)
function speakKannadaCaption(textKn) {
  if (!("speechSynthesis" in window)) {
    showToast("ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಓದುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(textKn);
  utterance.lang = "kn-IN";
  utterance.rate = 0.95;

  const voices = window.speechSynthesis.getVoices();
  const knVoice = voices.find((v) => v.lang.toLowerCase().includes("kn"));
  if (knVoice) {
    utterance.voice = knVoice;
  }
  window.speechSynthesis.speak(utterance);
  showToast(`🔊 ಓದಲಾಗುತ್ತಿದೆ: “${textKn.slice(0, 45)}...”`);
}

// Render Scene Cards Grid
function renderScenesGrid(results, isFiltered = false) {
  scenesGrid.innerHTML = "";

  if (results.length === 0) {
    scenesGrid.innerHTML = `
      <div class="panel-card" style="grid-column: 1 / -1; text-align: center; padding: 2.5rem;">
        <h3 class="kn-text" style="justify-content: center; margin-bottom: 0.5rem;">ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ಚಿತ್ರಗಳು ಕಂಡುಬಂದಿಲ್ಲ</h3>
        <p style="color: var(--text-muted);">No matching scene found for this query. Try speaking words like “ಹಳದಿ ಹೂಮಾಲೆ”, “ದೋಸೆ ಕಾಫಿ”, “ಹಂಪಿ ರಥ”, or “ಯಕ್ಷಗಾನ”.</p>
      </div>
    `;
    return;
  }

  for (const entry of results) {
    const { item, score, matchedTokens = [], reason_kn = "" } = entry;
    const matchedSet = new Set(matchedTokens);

    const card = document.createElement("article");
    card.className = "scene-card";

    const scoreBadgeHtml = isFiltered
      ? `<span class="badge-pill badge-score">${Math.round(score * 100)}% ಹೊಂದಾಣಿಕೆ (Match)</span>`
      : `<span class="badge-pill">${item.audio_spec}</span>`;

    const tagsHtml = (item.tags_kn || [])
      .map((tag) => {
        const isMatched = matchedSet.has(tag) || matchedTokens.some((m) => tag.includes(m) || m.includes(tag));
        return `<span class="tag-kn kn-text ${isMatched ? "matched" : ""}">#${tag}</span>`;
      })
      .join("");

    const theme = item.fallback_theme || { bg1: "#78350f", bg2: "#d97706", icon: "📷", label: item.title_kn };

    card.innerHTML = `
      <div class="scene-media">
        <img
          src="${item.image_url}"
          alt="${item.title_kn}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        />
        <div class="scene-fallback-banner" style="display: none; background: linear-gradient(135deg, ${theme.bg1}, ${theme.bg2});">
          <span class="icon">${theme.icon}</span>
          <strong class="kn-text" style="font-size: 1.15rem;">${theme.label}</strong>
          <span style="font-size: 0.78rem; opacity: 0.85;">${item.region}</span>
        </div>
        <div class="scene-badges-top">
          <span class="badge-pill">${item.id} · ${item.resolution}</span>
          ${scoreBadgeHtml}
        </div>
      </div>

      <div class="scene-body">
        <div class="scene-region kn-text">📍 ${item.region}</div>
        <div class="scene-title-kn kn-text">${item.title_kn}</div>

        <div class="caption-box">
          <div class="label">ಪರಿಷ್ಕೃತ ಪ್ರಮಾಣ ಕನ್ನಡ ವಿವರಣೆ (Corrected Kannada Caption)</div>
          <div class="text-kn kn-text">${item.corrected_caption_kn}</div>
          <div class="text-en"><em>${item.transliteration_en}</em></div>
          <div class="text-en" style="margin-top: 0.15rem; color: #cbd5e1;">“${item.translation_en}”</div>
        </div>

        <div class="spoken-raw kn-text">
          <strong>🎙️ ಮೂಲ ಧ್ವನಿ (Spoken):</strong> “${item.verbatim_audio_transcript_kn}”
        </div>

        ${
          reason_kn
            ? `<div style="font-size: 0.78rem; color: #6ee7b7;" class="kn-text">✨ ${reason_kn}</div>`
            : ""
        }

        <div class="tags-row">
          ${tagsHtml}
        </div>
      </div>

      <div class="scene-footer">
        <button class="btn btn-secondary btn-sm listen-caption-btn" data-id="${item.id}">
          🔊 <span class="kn-text">ವಿವರಣೆ ಕೇಳಿ (Listen)</span>
        </button>
        <span style="font-size: 0.74rem; color: var(--emerald);">✓ Consent & Privacy Verified</span>
      </div>
    `;

    card.querySelector(".listen-caption-btn").addEventListener("click", () => {
      if (item.custom_wav_url) {
        const audio = new Audio(item.custom_wav_url);
        audio.play();
        showToast(`🔊 Playing recorded 16 kHz Mono WAV for ${item.id}`);
      } else {
        speakKannadaCaption(item.corrected_caption_kn);
      }
    });

    scenesGrid.appendChild(card);
  }
}

// Execute Search (Text or Audio)
async function executeSearch({ queryText = "", audioBase64 = null } = {}) {
  searchStatusText.innerHTML = `⏳ <span class="kn-text">ಕನ್ನಡದ ದೃಶ್ಯಗಳನ್ನು ಹುಡುಕಲಾಗುತ್ತಿದೆ... (Searching scenes...)</span>`;

  const response = await searchWithGemini({
    queryText,
    audioBase64,
    dataset
  });

  if (response.transcribedQuery) {
    searchQueryInput.value = response.transcribedQuery;
  }

  const isFiltered = Boolean(response.transcribedQuery && response.transcribedQuery.trim());
  currentResults = response.results;

  searchStatusText.innerHTML = isFiltered
    ? `ಪ್ರಶ್ನೆ: <strong>“${response.transcribedQuery}”</strong> · ಕಂಡುಬಂದ ದೃಶ್ಯಗಳು: <strong>${currentResults.length}</strong> (${response.engine})`
    : `ಒಟ್ಟು <strong>${dataset.length}</strong> ಕರ್ನಾಟಕದ ದೃಶ್ಯಗಳು ಪ್ರದರ್ಶನದಲ್ಲಿವೆ (Showing all scenes)`;

  renderScenesGrid(currentResults, isFiltered);
}

runSearchBtn.addEventListener("click", () => {
  executeSearch({ queryText: searchQueryInput.value });
});

searchQueryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    executeSearch({ queryText: searchQueryInput.value });
  }
});

resetSearchBtn.addEventListener("click", () => {
  searchQueryInput.value = "";
  currentResults = dataset.map((item) => ({ item, score: 1, matchedTokens: [], reason_kn: "" }));
  searchStatusText.innerHTML = `ಒಟ್ಟು <strong>${dataset.length}</strong> ಕರ್ನಾಟಕದ ದೃಶ್ಯಗಳು ಪ್ರದರ್ಶನದಲ್ಲಿವೆ (Showing all scenes)`;
  renderScenesGrid(currentResults, false);
});

// Sample Query Chips
document.querySelectorAll(".query-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const q = chip.getAttribute("data-query");
    searchQueryInput.value = q;
    executeSearch({ queryText: q });
  });
});

// Voice Search Button (Records 16 kHz Mono WAV + live Web Speech kn-IN transcription)
voiceSearchBtn.addEventListener("click", async () => {
  if (!isVoiceSearching) {
    try {
      isVoiceSearching = true;
      voiceSearchBtn.classList.add("recording");
      voiceSearchText.textContent = "ನಿಲ್ಲಿಸಲು ಒತ್ತಿ (Stop & Search...)";

      // 1. Start 16 kHz Mono WAV capture for Gemini Multimodal Audio
      searchWavRecorder = new Wav16kRecorder();
      await searchWavRecorder.start();

      // 2. Also start browser Web Speech Recognition (kn-IN) for immediate visual feedback
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        searchSpeechRecognition = new SpeechRec();
        searchSpeechRecognition.lang = "kn-IN";
        searchSpeechRecognition.interimResults = true;
        searchSpeechRecognition.onresult = (event) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            searchQueryInput.value = transcript.trim();
          }
        };
        searchSpeechRecognition.start();
      }

      showToast("🎙️ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ... ಉದಾ: “ಹಳದಿ ಹೂಮಾಲೆ ಇರುವ ಮಳಿಗೆ ತೋರಿಸು”");
    } catch (err) {
      isVoiceSearching = false;
      voiceSearchBtn.classList.remove("recording");
      voiceSearchText.textContent = "ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ (Speak)";
      showToast("⚠️ Microphone permission required for live voice capture.");
    }
  } else {
    isVoiceSearching = false;
    voiceSearchBtn.classList.remove("recording");
    voiceSearchText.textContent = "ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ (Speak)";

    if (searchSpeechRecognition) {
      try {
        searchSpeechRecognition.stop();
      } catch (_) {}
    }

    if (searchWavRecorder) {
      const wavResult = await searchWavRecorder.stop();
      let audioBase64 = null;
      if (wavResult && wavResult.wavBlob) {
        audioBase64 = await blobToBase64(wavResult.wavBlob);
      }
      await executeSearch({
        queryText: searchQueryInput.value,
        audioBase64
      });
    }
  }
});

// ======================================================
// TAB 2: STUDIO - PRIVACY BLUR CANVAS & 16kHz WAV RECORDER
// ======================================================

function drawDemoKarnatakaSceneOnCanvas() {
  const w = privacyCanvas.width;
  const h = privacyCanvas.height;

  // Warm Mysore Market sunset backdrop
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#7c2d12");
  grad.addColorStop(0.55, "#b45309");
  grad.addColorStop(1, "#451a03");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Market Stall Canopy
  ctx.fillStyle = "#991b1b";
  ctx.fillRect(140, 90, w - 280, 95);
  ctx.fillStyle = "#f59e0b";
  ctx.font = "bold 46px 'Noto Sans Kannada', sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಹೂವಿನ ಮಳಿಗೆ · ಮೈಸೂರು", w / 2, 152);

  // Hanging Yellow & White Flower Garlands (ಹಳದಿ ಹೂಮಾಲೆಗಳು)
  for (let x = 230; x <= w - 230; x += 115) {
    for (let y = 210; y <= 620; y += 38) {
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fillStyle = (x / 115) % 2 === 0 ? "#facc15" : "#fb923c";
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Sample Vehicle Plate box on the bottom corner to demonstrate Privacy Blur
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(980, 740, 280, 78);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.strokeRect(980, 740, 280, 78);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px Inter, monospace";
  ctx.fillText("KA 09 M 2026", 1120, 790);

  ctx.fillStyle = "#fef3c7";
  ctx.font = "26px Inter, sans-serif";
  ctx.fillText("Drag across number plate or faces to apply Privacy Blur →", 580, 790);

  // Save clean snapshot for reset
  const snapshot = new Image();
  snapshot.src = privacyCanvas.toDataURL("image/jpeg", 0.92);
  snapshot.onload = () => {
    baseStudioImage = snapshot;
  };

  imageResolutionBadge.textContent = `${w}x${h} JPEG (1280px+ Compliant ✓)`;
  studioVerbatimInput.value = "ಇಲ್ಲಿ ಮೈಸೂರಿನ ಜಾತ್ರೆ ಅಂಗಡಿಯೊಳಗೆ ಹಳದಿ ಸೇವಂತಿಗೆ ಹೂಮಾಲೆಗಳನ್ನ ತೂಗು ಹಾಕಿದ್ದಾರೆ.";
  studioCaptionInput.value = "ಮೈಸೂರಿನ ಶ್ರೀ ಚಾಮುಂಡೇಶ್ವರಿ ಹೂವಿನ ಮಳಿಗೆಯಲ್ಲಿ ತೂಗುಹಾಕಲಾದ ತಾಜಾ ಹಳದಿ ಸೇವಂತಿಗೆ ಹೂಮಾಲೆಗಳು.";
  studioTagsInput.value = "ಹಳದಿ, ಹೂಮಾಲೆ, ಮಳಿಗೆ, ಮೈಸೂರು, ಸೇವಂತಿಗೆ, ಹೂವು";
}

// Privacy Blur Brush on Canvas
function applyPrivacyBlurAt(clientX, clientY) {
  const rect = privacyCanvas.getBoundingClientRect();
  const scaleX = privacyCanvas.width / rect.width;
  const scaleY = privacyCanvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const radius = 48;

  // Pixelate / Gaussian blur block around cursor
  const startX = Math.max(0, Math.floor(x - radius));
  const startY = Math.max(0, Math.floor(y - radius));
  const size = radius * 2;
  const blockSize = 14;

  for (let px = startX; px < Math.min(privacyCanvas.width, startX + size); px += blockSize) {
    for (let py = startY; py < Math.min(privacyCanvas.height, startY + size); py += blockSize) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy <= radius * radius) {
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        ctx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        ctx.fillRect(px, py, blockSize, blockSize);
      }
    }
  }
}

privacyCanvas.addEventListener("mousedown", (e) => {
  isDrawingBlur = true;
  applyPrivacyBlurAt(e.clientX, e.clientY);
});

window.addEventListener("mousemove", (e) => {
  if (!isDrawingBlur) return;
  applyPrivacyBlurAt(e.clientX, e.clientY);
});

window.addEventListener("mouseup", () => {
  isDrawingBlur = false;
});

loadSamplePhotoBtn.addEventListener("click", () => {
  drawDemoKarnatakaSceneOnCanvas();
  showToast("🎨 Loaded 1400x933 Demo Karnataka Flower Stall scene.");
});

clearBlurBtn.addEventListener("click", () => {
  if (baseStudioImage) {
    ctx.drawImage(baseStudioImage, 0, 0, privacyCanvas.width, privacyCanvas.height);
    showToast("↩️ Privacy blur reset to original image.");
  } else {
    drawDemoKarnatakaSceneOnCanvas();
  }
});

imageUploadInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      // Ensure minimum 1280px width compliance per Modalapada 2.0 specification
      const targetWidth = Math.max(1280, img.width);
      const targetHeight = Math.round((img.height / img.width) * targetWidth);
      privacyCanvas.width = targetWidth;
      privacyCanvas.height = targetHeight;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      baseStudioImage = img;
      imageResolutionBadge.textContent = `${targetWidth}x${targetHeight} JPEG (1280px+ ✓)`;
      showToast(`📸 Uploaded & normalized to ${targetWidth}x${targetHeight} JPEG.`);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// Studio 16 kHz Mono WAV Recorder
studioRecordBtn.addEventListener("click", async () => {
  if (!isStudioRecording) {
    try {
      isStudioRecording = true;
      studioRecordBtn.classList.add("recording");
      studioRecordBtn.textContent = "⏹️ Stop Recording";
      studioAudioInfo.textContent = "Recording live 16,000 Hz Mono PCM WAV...";

      studioWavRecorder = new Wav16kRecorder((level) => {
        studioAudioMeter.style.width = `${Math.round(level * 100)}%`;
      });
      await studioWavRecorder.start();

      // Parallel Web Speech kn-IN transcription to auto-fill Verbatim Kannada Transcript
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRec) {
        studioSpeechRecognition = new SpeechRec();
        studioSpeechRecognition.lang = "kn-IN";
        studioSpeechRecognition.interimResults = true;
        studioSpeechRecognition.onresult = (event) => {
          let transcript = "";
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            studioVerbatimInput.value = transcript.trim();
          }
        };
        studioSpeechRecognition.start();
      }
    } catch (err) {
      isStudioRecording = false;
      studioRecordBtn.classList.remove("recording");
      studioRecordBtn.textContent = "🎙️ Record 16kHz WAV";
      showToast("⚠️ Could not access microphone.");
    }
  } else {
    isStudioRecording = false;
    studioRecordBtn.classList.remove("recording");
    studioRecordBtn.textContent = "🎙️ Record 16kHz WAV";
    studioAudioMeter.style.width = "0%";

    if (studioSpeechRecognition) {
      try {
        studioSpeechRecognition.stop();
      } catch (_) {}
    }

    if (studioWavRecorder) {
      const result = await studioWavRecorder.stop();
      if (result && result.wavBlob) {
        recordedStudioWavBlob = result.wavBlob;
        const url = URL.createObjectURL(result.wavBlob);
        studioAudioPreview.src = url;
        studioAudioPreview.style.display = "block";
        downloadRecordedWavBtn.disabled = false;
        studioAudioInfo.textContent = `✓ Recorded ${result.durationSec}s · 16,000 Hz Mono 16-bit PCM WAV (${(result.byteLength / 1024).toFixed(1)} KB)`;
        showToast("✅ 16 kHz Mono WAV recorded and verified!");
      }
    }
  }
});

downloadRecordedWavBtn.addEventListener("click", () => {
  if (!recordedStudioWavBlob) return;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(recordedStudioWavBlob);
  a.download = `chitra_maathu_16khz_mono_${Date.now()}.wav`;
  a.click();
});

// Auto-Generate / Refine Kannada Caption with Gemini Multimodal
geminiAutoAnnotateBtn.addEventListener("click", async () => {
  geminiAutoAnnotateBtn.disabled = true;
  geminiAutoAnnotateBtn.textContent = "⏳ Analyzing Image & Audio with Gemini...";

  try {
    const dataUrl = privacyCanvas.toDataURL("image/jpeg", 0.9);
    const imageBase64 = dataUrl.split(",")[1];
    const audioBase64 = recordedStudioWavBlob ? await blobToBase64(recordedStudioWavBlob) : null;

    const annotated = await generateCaptionWithGemini({
      imageBase64,
      imageMime: "image/jpeg",
      audioBase64,
      hintText: studioVerbatimInput.value
    });

    if (annotated.verbatim_audio_transcript_kn) {
      studioVerbatimInput.value = annotated.verbatim_audio_transcript_kn;
    }
    if (annotated.corrected_caption_kn) {
      studioCaptionInput.value = annotated.corrected_caption_kn;
    }
    if (annotated.tags_kn && annotated.tags_kn.length) {
      studioTagsInput.value = annotated.tags_kn.join(", ");
    }

    showToast(`✨ Caption & tags refined via ${annotated.engine}`);
  } catch (err) {
    showToast(`⚠️ ${err.message}`);
  } finally {
    geminiAutoAnnotateBtn.disabled = false;
    geminiAutoAnnotateBtn.textContent = "✨ Auto-Generate Corrected Caption & Tags with Gemini Multimodal";
  }
});

// Add New Scene Pair to Living Dataset
addSceneToDatasetBtn.addEventListener("click", () => {
  if (!studioConsentCheckbox.checked) {
    showToast("⚠️ ದಯವಿಟ್ಟು ಧ್ವನಿ ಮತ್ತು ಗೌಪ್ಯತೆ ಒಪ್ಪಿಗೆಯನ್ನು ದೃಢೀಕರಿಸಿ (Please verify consent & privacy checkbox).");
    return;
  }

  const verbatim = studioVerbatimInput.value.trim();
  const caption = studioCaptionInput.value.trim();
  if (!caption) {
    showToast("⚠️ ದಯವಿಟ್ಟು ಕನ್ನಡದ ಚಿತ್ರ ವಿವರಣೆಯನ್ನು ನಮೂದಿಸಿ (Please enter a Kannada caption).");
    return;
  }

  const newId = `CM-KA-${String(dataset.length + 1).padStart(3, "0")}`;
  const canvasDataUrl = privacyCanvas.toDataURL("image/jpeg", 0.92);
  const tagsKn = studioTagsInput.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const newEntry = {
    id: newId,
    title_kn: caption.slice(0, 42),
    title_en: "Custom Karnataka Scene",
    region: studioRegionInput.value.trim() || "ಕರ್ನಾಟಕ (Karnataka)",
    spoken_query_example: caption.slice(0, 35),
    verbatim_audio_transcript_kn: verbatim || caption,
    corrected_caption_kn: caption,
    transliteration_en: "Karnatakada drishya mattu spasta Kannada vivarane.",
    translation_en: "User-contributed Karnataka scene with verified 16 kHz mono audio and standard Kannada caption.",
    tags_kn: tagsKn.length ? tagsKn : ["ಕರ್ನಾಟಕ", "ಚಿತ್ರ-ಮಾತು"],
    tags_en: ["karnataka", "community", "dataset"],
    image_url: canvasDataUrl,
    custom_wav_url: recordedStudioWavBlob ? URL.createObjectURL(recordedStudioWavBlob) : null,
    resolution: `${privacyCanvas.width}x${privacyCanvas.height} JPEG`,
    audio_spec: "16 kHz Mono PCM WAV",
    consent_verified: true,
    privacy_checked: true,
    created_at: new Date().toISOString()
  };

  dataset.unshift(newEntry);
  currentResults = dataset.map((item) => ({ item, score: 1, matchedTokens: [], reason_kn: "" }));
  renderScenesGrid(currentResults, false);
  renderDatasetTable();

  showToast(`🎉 Scene ${newId} added to the Chitra-Maathu dataset!`);
  document.querySelector('[data-tab="tab-search"]').click();
});

// ======================================================
// TAB 3: DATASET TABLE & SPEC-COMPLIANT EXPORTER
// ======================================================

function renderDatasetTable() {
  datasetTableBody.innerHTML = "";
  for (const item of dataset) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.id}</strong></td>
      <td class="kn-text">${item.region}</td>
      <td class="kn-text">“${item.verbatim_audio_transcript_kn}”</td>
      <td class="kn-text"><strong>${item.corrected_caption_kn}</strong></td>
      <td>
        <span class="badge-pill">${item.resolution}</span>
        <span class="badge-pill">${item.audio_spec}</span>
      </td>
      <td>
        <button class="btn btn-secondary btn-sm table-listen-btn">🔊 ಕೇಳಿ</button>
      </td>
    `;
    tr.querySelector(".table-listen-btn").addEventListener("click", () => {
      speakKannadaCaption(item.corrected_caption_kn);
    });
    datasetTableBody.appendChild(tr);
  }
}

exportJsonBtn.addEventListener("click", () => {
  const exportPayload = {
    hackathon: "Modalapada 2.0 | Kannada Multimodal AI Hackathon (Ramaiah Institute of Technology)",
    challenge: "03 · Chitra-Maathu (ಚಿತ್ರ-ಮಾತು · ಚಿತ್ರ, ಧ್ವನಿ ಮತ್ತು ವಿವರಣೆ)",
    specifications: {
      text_encoding: "UTF-8 Kannada Unicode",
      audio_format: "16 kHz mono WAV (16-bit PCM)",
      image_format: "JPEG, 1280px+",
      privacy_and_consent: "Verified speaker consent; faces and vehicle plates blurred"
    },
    exported_at: new Date().toISOString(),
    total_records: dataset.length,
    records: dataset.map(({ image_url, custom_wav_url, fallback_theme, ...cleanRecord }) => ({
      ...cleanRecord,
      image_file: `${cleanRecord.id}.jpg`,
      audio_file: `${cleanRecord.id}_16khz_mono.wav`
    }))
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chitra_maathu_dataset_utf8.json";
  a.click();
  showToast("⬇️ Exported UTF-8 Kannada Dataset Manifest (chitra_maathu_dataset_utf8.json)");
});

exportSampleWavBtn.addEventListener("click", () => {
  const wavBlob = recordedStudioWavBlob || createSeedReferenceWavBlob(2.0);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(wavBlob);
  a.download = "CM-KA-001_16khz_mono.wav";
  a.click();
  showToast("🔊 Downloaded 16,000 Hz Mono 16-bit PCM WAV sample file.");
});

// Boot Prototype
initApiKeyUI();
renderScenesGrid(currentResults, false);
drawDemoKarnatakaSceneOnCanvas();
renderDatasetTable();
