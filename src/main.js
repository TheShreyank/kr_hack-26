import { SEED_DATASET } from "./data/seedDataset.js";
import { Wav16kRecorder, blobToBase64 } from "./utils/wavEncoder.js";
import { searchScenes, generateSceneCaption } from "./utils/geminiService.js";

const CATEGORY_LABELS_KN = {
  Streets: "ರಸ್ತೆಗಳು (Streets)",
  Food: "ಆಹಾರ (Food)",
  Festivals: "ಹಬ್ಬ-ಜಾತ್ರೆ (Festivals)",
  Nature: "ಪ್ರಕೃತಿ (Nature)",
  Building: "ಕಟ್ಟಡಗಳು (Building)"
};

let dataset = [...SEED_DATASET];
let activeCategory = "All";
let currentResults = dataset.map((item) => ({
  item,
  score: 1,
  matchedTokens: []
}));

// Active audio player tracker
let activeAudio = null;
let activePlayButton = null;

// Voice Search State
let isVoiceSearching = false;
let searchWavRecorder = null;
let searchSpeechRecognition = null;
let searchFinalTranscript = "";

// Modal State
let isStudioRecording = false;
let studioWavRecorder = null;
let studioSpeechRecognition = null;
let studioFinalTranscript = "";
let recordedStudioWavBlob = null;
let recordedDurationSec = 0;
let recordingTimerInterval = null;
let recordingSecondsElapsed = 0;

// Canvas & Blur State
let uploadedOriginalImage = null;
let hasUploadedPhoto = false;
let isBlurring = false;

// DOM Elements
const searchQueryInput = document.getElementById("searchQueryInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const voiceSearchBtn = document.getElementById("voiceSearchBtn");
const voiceSearchText = document.getElementById("voiceSearchText");
const runSearchBtn = document.getElementById("runSearchBtn");
const showAllBtn = document.getElementById("showAllBtn");
const searchStatusText = document.getElementById("searchStatusText");
const scenesGrid = document.getElementById("scenesGrid");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// Modal Elements
const addSceneModal = document.getElementById("addSceneModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeAddModalBtn = document.getElementById("closeAddModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const imageUploadInput = document.getElementById("imageUploadInput");
const uploadCanvas = document.getElementById("uploadCanvas");
const uploadCtx = uploadCanvas.getContext("2d");
const resetBlurBtn = document.getElementById("resetBlurBtn");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");

const studioRecordBtn = document.getElementById("studioRecordBtn");
const recordingTimerBadge = document.getElementById("recordingTimerBadge");
const studioAudioInfo = document.getElementById("studioAudioInfo");
const studioAudioPreview = document.getElementById("studioAudioPreview");
const studioRegionInput = document.getElementById("studioRegionInput");
const studioCategorySelect = document.getElementById("studioCategorySelect");
const studioSpeakerInput = document.getElementById("studioSpeakerInput");
const studioVerbatimInput = document.getElementById("studioVerbatimInput");
const studioCaptionInput = document.getElementById("studioCaptionInput");
const autoCaptionBtn = document.getElementById("autoCaptionBtn");
const addSceneToDatasetBtn = document.getElementById("addSceneToDatasetBtn");

const toastBanner = document.getElementById("toastBanner");

// Restore last speaker ID if saved
const savedSpeaker = localStorage.getItem("chitra_maathu_speaker_id");
if (savedSpeaker) {
  studioSpeakerInput.value = savedSpeaker;
}

function showToast(message) {
  toastBanner.textContent = message;
  toastBanner.classList.add("show");
  setTimeout(() => {
    toastBanner.classList.remove("show");
  }, 3200);
}

/**
 * Helper to create a continuous Kannada SpeechRecognition session that does NOT
 * cut off after a short pause or drop words across breaths.
 */
function createContinuousKannadaRecognition({ isActiveFn, onTranscriptUpdate }) {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) return null;

  const recognition = new SpeechRec();
  recognition.lang = "kn-IN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let committedText = "";

  recognition.onresult = (event) => {
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const segment = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        committedText += (committedText ? " " : "") + segment.trim();
      } else {
        interimText += segment;
      }
    }
    const combined = `${committedText} ${interimText}`.trim();
    if (combined) {
      onTranscriptUpdate(combined);
    }
  };

  recognition.onend = () => {
    if (isActiveFn()) {
      try {
        recognition.start();
      } catch (_) {}
    }
  };

  return recognition;
}

// Reliable Audio Playback
function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  if (activePlayButton) {
    activePlayButton.classList.remove("playing");
    activePlayButton.innerHTML = `🔊 <span class="kn-text">ಧ್ವನಿ ಕೇಳಿ (Play Audio)</span>`;
    activePlayButton = null;
  }
}

function playSceneAudio(item, btnElement) {
  if (activePlayButton === btnElement) {
    stopActiveAudio();
    return;
  }

  stopActiveAudio();
  activePlayButton = btnElement;
  btnElement.classList.add("playing");
  btnElement.innerHTML = `⏹️ <span class="kn-text">ನಿಲ್ಲಿಸಿ (Stop Audio)</span>`;

  const audioSrc = item.custom_wav_url || item.audio_url;

  if (audioSrc) {
    const audio = new Audio(audioSrc);
    activeAudio = audio;
    audio.onended = () => {
      stopActiveAudio();
    };
    audio.onerror = () => {
      fallbackSpeech(item);
    };
    audio.play().catch(() => {
      fallbackSpeech(item);
    });
    return;
  }

  fallbackSpeech(item);
}

function fallbackSpeech(item) {
  if (!("speechSynthesis" in window)) {
    stopActiveAudio();
    showToast("Audio playback unavailable.");
    return;
  }

  const voices = window.speechSynthesis.getVoices();
  const knVoice = voices.find((v) => v.lang.toLowerCase().includes("kn"));

  const utterance = new SpeechSynthesisUtterance(
    knVoice ? item.corrected_caption_kn : item.transliteration_en || item.translation_en || item.corrected_caption_kn
  );

  if (knVoice) {
    utterance.voice = knVoice;
    utterance.lang = "kn-IN";
  } else {
    const inVoice = voices.find((v) => v.lang.toLowerCase().includes("in")) || voices[0];
    if (inVoice) utterance.voice = inVoice;
    utterance.lang = "en-IN";
  }

  utterance.rate = 0.95;
  utterance.onend = () => stopActiveAudio();
  utterance.onerror = () => stopActiveAudio();
  window.speechSynthesis.speak(utterance);
}

function getFilteredResultsByCategory(resultsList) {
  if (activeCategory === "All") return resultsList;
  return resultsList.filter((entry) => entry.item.category === activeCategory);
}

// Render Photo Gallery Grid
function renderScenesGrid(results, isFiltered = false) {
  stopActiveAudio();
  scenesGrid.innerHTML = "";

  const displayList = getFilteredResultsByCategory(results);

  if (displayList.length === 0) {
    scenesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 16px; box-shadow: var(--shadow-md);">
        <h3 class="kn-text" style="margin-bottom: 0.4rem;">ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ಚಿತ್ರಗಳು ಕಂಡುಬಂದಿಲ್ಲ</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Try searching for “ದೇವಸ್ಥಾನದ ಹೂವಿನ ಅಂಗಡಿ”, “ಕಾಲೇಜಿನ ಹತ್ತಿರದ ಪಾನಿಪೂರಿ ಅಂಗಡಿ”, “ಮೈಸೂರು ಅರಮನೆ”, or switch category to “ಎಲ್ಲಾ (All)”.</p>
      </div>
    `;
    return;
  }

  for (const entry of displayList) {
    const { item, score, matchedTokens = [] } = entry;
    const matchedSet = new Set(matchedTokens);

    const card = document.createElement("article");
    card.className = "scene-card";

    const categoryBadgeText = item.category_kn || CATEGORY_LABELS_KN[item.category] || item.category || "";
    const rightBadgeHtml = isFiltered
      ? `<span class="badge-pill badge-score">${Math.round(score * 100)}% ಹೊಂದಾಣಿಕೆ</span>`
      : categoryBadgeText
      ? `<span class="badge-pill kn-text">${categoryBadgeText}</span>`
      : "";

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
        </div>
        <div class="scene-badges-top">
          <span class="badge-pill kn-text">📍 ${item.region}</span>
          ${rightBadgeHtml}
        </div>
      </div>

      <div class="scene-body">
        <div class="scene-title-kn kn-text">${item.title_kn}</div>

        <div class="caption-box">
          <div class="text-kn kn-text">${item.corrected_caption_kn}</div>
          <div class="text-en">${item.translation_en}</div>
        </div>

        <div class="spoken-raw kn-text">
          <strong>🎙️ ಆಡುಮಾತು:</strong> “${item.verbatim_audio_transcript_kn}”
        </div>

        <div class="tags-row">
          ${tagsHtml}
        </div>
      </div>

      <div class="scene-footer">
        <button class="btn btn-sm btn-audio listen-caption-btn">
          🔊 <span class="kn-text">ಧ್ವನಿ ಕೇಳಿ (Play Audio)</span>
        </button>
        <button class="btn btn-sm btn-delete delete-scene-btn" title="Delete this entry">
          🗑️ <span class="kn-text">ಅಳಿಸಿ</span>
        </button>
      </div>
    `;

    const playBtn = card.querySelector(".listen-caption-btn");
    playBtn.addEventListener("click", () => {
      playSceneAudio(item, playBtn);
    });

    const deleteBtn = card.querySelector(".delete-scene-btn");
    deleteBtn.addEventListener("click", () => {
      stopActiveAudio();
      dataset = dataset.filter((d) => d.id !== item.id);
      currentResults = currentResults.filter((r) => r.item.id !== item.id);
      const isCurrentlyFiltered = Boolean(searchQueryInput.value.trim());
      updateStatusText(isCurrentlyFiltered);
      renderScenesGrid(currentResults, isCurrentlyFiltered);
      showToast(`🗑️ ಚಿತ್ರವನ್ನು ಅಳಿಸಲಾಗಿದೆ (${item.id} deleted)`);
    });

    scenesGrid.appendChild(card);
  }
}

function updateStatusText(isFiltered) {
  const cleanQ = (searchQueryInput.value || "").trim();
  const visibleCount = getFilteredResultsByCategory(currentResults).length;
  if (isFiltered && cleanQ) {
    searchStatusText.innerHTML = `<strong>“${cleanQ}”</strong> — <strong>${visibleCount}</strong> ಚಿತ್ರಗಳು`;
  } else {
    searchStatusText.textContent = `ಚಿತ್ರಗಳು (${visibleCount})`;
  }
}

// Search Execution
async function executeSearch({ queryText = "", audioBase64 = null } = {}) {
  searchStatusText.textContent = "⏳ ಹುಡುಕಲಾಗುತ್ತಿದೆ...";

  const response = await searchScenes({
    queryText,
    audioBase64,
    dataset
  });

  if (response.transcribedQuery) {
    searchQueryInput.value = response.transcribedQuery;
  }

  const cleanQ = (searchQueryInput.value || "").trim();
  clearSearchBtn.style.display = cleanQ ? "block" : "none";
  showAllBtn.style.display = cleanQ || activeCategory !== "All" ? "inline-flex" : "none";

  const isFiltered = Boolean(cleanQ);
  currentResults = response.results;

  updateStatusText(isFiltered);
  renderScenesGrid(currentResults, isFiltered);
}

function resetSearch() {
  searchQueryInput.value = "";
  activeCategory = "All";
  document.querySelectorAll(".cat-chip").forEach((c) => {
    c.classList.toggle("active", c.getAttribute("data-category") === "All");
  });
  clearSearchBtn.style.display = "none";
  showAllBtn.style.display = "none";
  currentResults = dataset.map((item) => ({ item, score: 1, matchedTokens: [] }));
  updateStatusText(false);
  renderScenesGrid(currentResults, false);
}

runSearchBtn.addEventListener("click", () => {
  executeSearch({ queryText: searchQueryInput.value });
});

searchQueryInput.addEventListener("input", () => {
  clearSearchBtn.style.display = searchQueryInput.value.trim() ? "block" : "none";
});

searchQueryInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    executeSearch({ queryText: searchQueryInput.value });
  }
});

clearSearchBtn.addEventListener("click", resetSearch);
showAllBtn.addEventListener("click", resetSearch);

document.querySelectorAll(".query-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const q = chip.getAttribute("data-query");
    searchQueryInput.value = q;
    executeSearch({ queryText: q });
  });
});

// Category Filter Chips
document.querySelectorAll(".cat-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".cat-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    activeCategory = chip.getAttribute("data-category");
    const isFiltered = Boolean(searchQueryInput.value.trim());
    showAllBtn.style.display = isFiltered || activeCategory !== "All" ? "inline-flex" : "none";
    updateStatusText(isFiltered);
    renderScenesGrid(currentResults, isFiltered);
  });
});

// Voice Search Button
voiceSearchBtn.addEventListener("click", async () => {
  if (!isVoiceSearching) {
    try {
      stopActiveAudio();
      isVoiceSearching = true;
      searchFinalTranscript = "";
      voiceSearchBtn.classList.add("recording");
      voiceSearchText.textContent = "ನಿಲ್ಲಿಸಿ (Stop)";

      searchWavRecorder = new Wav16kRecorder();
      await searchWavRecorder.start();

      searchSpeechRecognition = createContinuousKannadaRecognition({
        isActiveFn: () => isVoiceSearching,
        onTranscriptUpdate: (fullText) => {
          searchFinalTranscript = fullText;
          searchQueryInput.value = fullText;
        }
      });
      if (searchSpeechRecognition) {
        searchSpeechRecognition.start();
      }

      showToast("🎙️ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ... (Speak your full query)");
    } catch (err) {
      isVoiceSearching = false;
      voiceSearchBtn.classList.remove("recording");
      voiceSearchText.textContent = "ಮಾತನಾಡಿ (Speak)";
      showToast("⚠️ ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಿ (Microphone permission needed).");
    }
  } else {
    isVoiceSearching = false;
    voiceSearchBtn.classList.remove("recording");
    voiceSearchText.textContent = "ಮಾತನಾಡಿ (Speak)";

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
        queryText: searchFinalTranscript || searchQueryInput.value,
        audioBase64
      });
    }
  }
});

// ======================================================
// ADD PHOTO & VOICE TRIPLET MODAL
// ======================================================

function openModal() {
  stopActiveAudio();
  studioRegionInput.value = "";
  studioCategorySelect.value = "Streets";
  addSceneModal.classList.add("open");
  addSceneModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  addSceneModal.classList.remove("open");
  addSceneModal.setAttribute("aria-hidden", "true");
}

openAddModalBtn.addEventListener("click", openModal);
closeAddModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

// Upload Photo onto 1280px+ Canvas + Drag-to-Blur Faces/Plates
imageUploadInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const targetW = Math.max(1280, img.width);
      const targetH = Math.round((img.height / img.width) * targetW);
      uploadCanvas.width = targetW;
      uploadCanvas.height = targetH;
      uploadCtx.drawImage(img, 0, 0, targetW, targetH);
      uploadedOriginalImage = img;
      hasUploadedPhoto = true;
      uploadCanvas.style.display = "block";
      uploadPlaceholder.style.display = "none";
      resetBlurBtn.style.display = "inline-flex";
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});

function applyCanvasBlur(clientX, clientY) {
  if (!hasUploadedPhoto) return;
  const rect = uploadCanvas.getBoundingClientRect();
  const scaleX = uploadCanvas.width / rect.width;
  const scaleY = uploadCanvas.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  const radius = Math.round(uploadCanvas.width * 0.035);
  const blockSize = Math.max(12, Math.round(radius / 3));

  const startX = Math.max(0, Math.floor(x - radius));
  const startY = Math.max(0, Math.floor(y - radius));
  const size = radius * 2;

  for (let px = startX; px < Math.min(uploadCanvas.width, startX + size); px += blockSize) {
    for (let py = startY; py < Math.min(uploadCanvas.height, startY + size); py += blockSize) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy <= radius * radius) {
        const pixel = uploadCtx.getImageData(px, py, 1, 1).data;
        uploadCtx.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
        uploadCtx.fillRect(px, py, blockSize, blockSize);
      }
    }
  }
}

uploadCanvas.addEventListener("mousedown", (e) => {
  isBlurring = true;
  applyCanvasBlur(e.clientX, e.clientY);
});

window.addEventListener("mousemove", (e) => {
  if (!isBlurring) return;
  applyCanvasBlur(e.clientX, e.clientY);
});

window.addEventListener("mouseup", () => {
  isBlurring = false;
});

resetBlurBtn.addEventListener("click", () => {
  if (uploadedOriginalImage) {
    uploadCtx.drawImage(uploadedOriginalImage, 0, 0, uploadCanvas.width, uploadCanvas.height);
    showToast("↩️ ಚಿತ್ರದ ಬ್ಲರ್ ತೆಗೆಯಲಾಗಿದೆ (Blur reset).");
  }
});

const CATEGORY_DEFAULT_TAGS_KN = {
  Streets: ["ಬೀದಿ_ಜನಜೀವನ", "ನಗರ_ಸಂಚಾರ", "ಕರ್ನಾಟಕ_ದೃಶ್ಯ", "ದಿನನಿತ್ಯದ_ಬದುಕು"],
  Food: ["ಬೀದಿ_ಆಹಾರ", "ಕರ್ನಾಟಕ_ರುಚಿ", "ಸ್ಥಳೀಯ_ತಿಂಡಿ", "ಆಹಾರ_ಸಂಸ್ಕೃತಿ"],
  Festivals: ["ನಾಡಹಬ್ಬ_ಸಂಭ್ರಮ", "ಸಾಂಸ್ಕೃತಿಕ_ಪರಂಪರೆ", "ಹಬ್ಬ_ಜಾತ್ರೆ", "ಕರ್ನಾಟಕ_ಉತ್ಸವ"],
  Nature: ["ಪ್ರಕೃತಿ_ಸೌಂದರ್ಯ", "ಕರಾವಳಿ_ಮಲೆನಾಡು", "ಹಸಿರು_ಪರಿಸರ", "ಕರ್ನಾಟಕ_ಪ್ರವಾಸ"],
  Building: ["ಪಾರಂಪರಿಕ_ಕಟ್ಟಡ", "ವಾಸ್ತುಶಿಲ್ಪ_ವೈಭವ", "ಕರ್ನಾಟಕ_ಸ್ಮಾರಕ", "ಐತಿಹಾಸಿಕ_ಕಟ್ಟಡ"]
};

let lastAnnotatedData = null;

async function runAudioAndImageTranscription() {
  autoCaptionBtn.disabled = true;
  autoCaptionBtn.textContent = "⏳ ರಚಿಸಲಾಗುತ್ತಿದೆ...";

  try {
    const imageBase64 = hasUploadedPhoto
      ? uploadCanvas.toDataURL("image/jpeg", 0.9).split(",")[1]
      : null;
    const audioBase64 = recordedStudioWavBlob ? await blobToBase64(recordedStudioWavBlob) : null;

    const annotated = await generateSceneCaption({
      imageBase64,
      imageMime: "image/jpeg",
      audioBase64,
      hintText: studioVerbatimInput.value
    });

    lastAnnotatedData = annotated;

    if (annotated.verbatim_audio_transcript_kn) {
      studioVerbatimInput.value = annotated.verbatim_audio_transcript_kn;
    }
    if (annotated.corrected_caption_kn) {
      studioCaptionInput.value = annotated.corrected_caption_kn;
    }
    showToast("✨ ನಿಮ್ಮ ಪೂರ್ಣ ಧ್ವನಿ ವಿವರಣೆ ಸಿದ್ಧವಾಗಿದೆ!");
  } catch (err) {
    showToast("⚠️ ದಯವಿಟ್ಟು ವಿವರಣೆಯನ್ನು ಪರಿಶೀಲಿಸಿ.");
  } finally {
    autoCaptionBtn.disabled = false;
    autoCaptionBtn.innerHTML = `✨ <span class="kn-text">ಸ್ವಯಂ ವಿವರಣೆ ರಚಿಸಿ (Auto-Caption)</span>`;
  }
}

function updateTimerDisplay(sec) {
  const padded = String(sec).padStart(2, "0");
  if (sec >= 15 && sec <= 30) {
    recordingTimerBadge.classList.add("ready");
    recordingTimerBadge.textContent = `00:${padded}s (15–30s Target ✓)`;
  } else {
    recordingTimerBadge.classList.remove("ready");
    recordingTimerBadge.textContent = `00:${padded}s (Target: 15–30s)`;
  }
}

studioRecordBtn.addEventListener("click", async () => {
  if (!isStudioRecording) {
    try {
      isStudioRecording = true;
      studioFinalTranscript = "";
      recordingSecondsElapsed = 0;
      updateTimerDisplay(0);

      studioRecordBtn.classList.add("recording");
      studioRecordBtn.innerHTML = `⏹️ <span class="kn-text">ನಿಲ್ಲಿಸಿ (Stop)</span>`;
      studioAudioInfo.textContent = "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ... ಪೂರ್ಣ ವಾಕ್ಯವನ್ನು ಮಾತನಾಡಿ (15–30s)";

      recordingTimerInterval = setInterval(() => {
        recordingSecondsElapsed += 1;
        updateTimerDisplay(recordingSecondsElapsed);
      }, 1000);

      studioWavRecorder = new Wav16kRecorder();
      await studioWavRecorder.start();

      studioSpeechRecognition = createContinuousKannadaRecognition({
        isActiveFn: () => isStudioRecording,
        onTranscriptUpdate: (fullText) => {
          studioFinalTranscript = fullText;
          studioVerbatimInput.value = fullText;
        }
      });
      if (studioSpeechRecognition) {
        studioSpeechRecognition.start();
      }
    } catch (err) {
      isStudioRecording = false;
      clearInterval(recordingTimerInterval);
      studioRecordBtn.classList.remove("recording");
      studioRecordBtn.innerHTML = `🎙️ <span class="kn-text">ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ (Record)</span>`;
      showToast("⚠️ ಮೈಕ್ರೊಫೋನ್ ಲಭ್ಯವಿಲ್ಲ.");
    }
  } else {
    isStudioRecording = false;
    clearInterval(recordingTimerInterval);
    studioRecordBtn.classList.remove("recording");
    studioRecordBtn.innerHTML = `🎙️ <span class="kn-text">ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ (Record)</span>`;

    if (studioSpeechRecognition) {
      try {
        studioSpeechRecognition.stop();
      } catch (_) {}
    }

    if (studioWavRecorder) {
      const result = await studioWavRecorder.stop();
      if (result && result.wavBlob) {
        recordedStudioWavBlob = result.wavBlob;
        recordedDurationSec = Number(result.durationSec);
        studioAudioPreview.src = URL.createObjectURL(result.wavBlob);
        studioAudioPreview.style.display = "block";
        studioAudioInfo.textContent = `✓ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗಿದೆ (${result.durationSec}s) — ಪೂರ್ಣ ವಾಕ್ಯವನ್ನು ಪರಿವರ್ತಿಸಲಾಗುತ್ತಿದೆ...`;

        await runAudioAndImageTranscription();
        studioAudioInfo.textContent = `✓ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮತ್ತು ಪಠ್ಯ ಸಿದ್ಧವಾಗಿದೆ (${result.durationSec}s)`;
      }
    }
  }
});

autoCaptionBtn.addEventListener("click", runAudioAndImageTranscription);

addSceneToDatasetBtn.addEventListener("click", () => {
  const caption = studioCaptionInput.value.trim();
  const verbatim = studioVerbatimInput.value.trim();

  if (!caption && !verbatim) {
    showToast("⚠️ ದಯವಿಟ್ಟು ಚಿತ್ರದ ಕನ್ನಡ ವಿವರಣೆಯನ್ನು ಬರೆಯಿರಿ.");
    return;
  }

  const finalCaption = caption || verbatim;
  const newId = `CM-KA-${String(dataset.length + 1).padStart(3, "0")}`;
  const selectedCategory = studioCategorySelect.value || "Streets";
  const speakerId = studioSpeakerInput.value.trim() || "SPK-01";
  localStorage.setItem("chitra_maathu_speaker_id", speakerId);

  const imageDataUrl = hasUploadedPhoto
    ? uploadCanvas.toDataURL("image/jpeg", 0.92)
    : "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1400&q=85";

  const curatedTags =
    lastAnnotatedData?.tags_kn && lastAnnotatedData.tags_kn.length
      ? lastAnnotatedData.tags_kn
      : CATEGORY_DEFAULT_TAGS_KN[selectedCategory] || ["ಕರ್ನಾಟಕ_ಸಂಸ್ಕೃತಿ", "ಜನಜೀವನ_ದೃಶ್ಯ"];

  const newEntry = {
    id: newId,
    title_kn: lastAnnotatedData?.title_kn || finalCaption.slice(0, 38),
    title_en: lastAnnotatedData?.title_en || "Karnataka Cultural Scene",
    region: studioRegionInput.value.trim() || "ಮೈಸೂರು (Mysuru)",
    category: selectedCategory,
    category_kn: CATEGORY_LABELS_KN[selectedCategory] || selectedCategory,
    speaker_id: speakerId,
    duration_sec: recordedDurationSec || 18.0,
    spoken_query_example: finalCaption.slice(0, 32),
    verbatim_audio_transcript_kn: verbatim || finalCaption,
    corrected_caption_kn: finalCaption,
    transliteration_en: lastAnnotatedData?.transliteration_en || finalCaption,
    translation_en: lastAnnotatedData?.translation_en || "A candid scene capturing everyday life in Karnataka.",
    tags_kn: curatedTags,
    tags_en: ["karnataka", selectedCategory.toLowerCase()],
    image_url: imageDataUrl,
    custom_wav_url: recordedStudioWavBlob ? URL.createObjectURL(recordedStudioWavBlob) : null,
    fallback_theme: { bg1: "#78350f", bg2: "#d97706", icon: "📷", label: finalCaption.slice(0, 24) }
  };

  lastAnnotatedData = null;

  dataset.unshift(newEntry);
  resetSearch();
  closeModal();

  // Reset modal fields
  studioRegionInput.value = "";
  studioCategorySelect.value = "Streets";
  studioVerbatimInput.value = "";
  studioCaptionInput.value = "";
  recordedStudioWavBlob = null;
  recordedDurationSec = 0;
  hasUploadedPhoto = false;
  uploadedOriginalImage = null;
  uploadCanvas.style.display = "none";
  resetBlurBtn.style.display = "none";
  uploadPlaceholder.style.display = "block";
  studioAudioPreview.style.display = "none";
  updateTimerDisplay(0);
  studioAudioInfo.textContent = "ಮೈಕ್ ಒತ್ತಿ ಚಿತ್ರದ ಬಗ್ಗೆ ಕನ್ನಡದಲ್ಲಿ 15–30 ಸೆಕೆಂಡ್ ಮಾತನಾಡಿ";

  showToast(`✅ ಟ್ರಿಪ್ಲೆಟ್ ${newId} ಸೇರಿಸಲಾಗಿದೆ!`);
});

// Export Official Metadata CSV (Slide 2: place, category, speaker ID, one row per triplet)
function escapeCsvField(val) {
  const str = String(val ?? "").replace(/"/g, '""');
  return `"${str}"`;
}

exportCsvBtn.addEventListener("click", () => {
  const headers = [
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
  ];

  const rows = dataset.map((d) => [
    d.id,
    `photos/${d.id}.jpg`,
    `audio/${d.id}.wav`,
    `captions/${d.id}.txt`,
    d.region || "ಕರ್ನಾಟಕ",
    d.category || "Streets",
    d.speaker_id || "SPK-01",
    d.duration_sec || 18.0,
    d.verbatim_audio_transcript_kn || "",
    d.corrected_caption_kn || ""
  ]);

  const csvContent =
    "\uFEFF" +
    [headers.map(escapeCsvField).join(","), ...rows.map((r) => r.map(escapeCsvField).join(","))].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "metadata.csv";
  a.click();
  showToast("⬇️ ಡೇಟಾಸೆಟ್ CSV ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ (metadata.csv)");
});

// Boot App
updateStatusText(false);
renderScenesGrid(currentResults, false);
