import { SEED_DATASET } from "./data/seedDataset.js";
import { Wav16kRecorder, blobToBase64 } from "./utils/wavEncoder.js";
import { searchScenes, generateSceneCaption, detectFacesAndPlates } from "./utils/geminiService.js";

const CATEGORY_LABELS_KN = {
  Streets: "ರಸ್ತೆಗಳು (Streets)",
  Food: "ಆಹಾರ (Food)",
  Festivals: "ಹಬ್ಬ-ಜಾತ್ರೆ (Festivals)",
  Culture: "ಸಂಸ್ಕೃತಿ (Culture)",
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

let activeAudio = null;
let activePlayButton = null;

let isVoiceSearching = false;
let searchWavRecorder = null;
let searchSpeechRecognition = null;
let searchFinalTranscript = "";

let isStudioRecording = false;
let studioWavRecorder = null;
let studioSpeechRecognition = null;
let studioFinalTranscript = "";
let recordedStudioWavBlob = null;
let recordedDurationSec = 0;
let recordingTimerInterval = null;
let recordingSecondsElapsed = 0;

let uploadedOriginalImage = null;
let hasUploadedPhoto = false;
let isBlurring = false;

const searchQueryInput = document.getElementById("searchQueryInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const voiceSearchBtn = document.getElementById("voiceSearchBtn");
const voiceSearchText = document.getElementById("voiceSearchText");
const runSearchBtn = document.getElementById("runSearchBtn");
const showAllBtn = document.getElementById("showAllBtn");
const searchStatusText = document.getElementById("searchStatusText");
const scenesGrid = document.getElementById("scenesGrid");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const helpScrollBtn = document.getElementById("helpScrollBtn");

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
        <button class="btn btn-sm btn-edit edit-scene-btn" title="Edit this entry">
          ✏️ <span class="kn-text">ಸಂಪಾದಿಸಿ</span>
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

    const editBtn = card.querySelector(".edit-scene-btn");
    editBtn.addEventListener("click", () => {
      openEditModal(item);
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

let editingSceneId = null;
const modalTitleEl = document.getElementById("modalTitle");

function resetModalFormFields() {
  studioRegionInput.value = "";
  studioCategorySelect.value = "Streets";
  studioVerbatimInput.value = "";
  studioCaptionInput.value = "";
  recordedStudioWavBlob = null;
  recordedDurationSec = 0;
  hasUploadedPhoto = false;
  uploadedOriginalImage = null;
  lastAnnotatedData = null;
  uploadCanvas.style.display = "none";
  resetBlurBtn.style.display = "none";
  uploadPlaceholder.style.display = "block";
  studioAudioPreview.style.display = "none";
  studioAudioPreview.src = "";
  updateTimerDisplay(0);
  studioAudioInfo.textContent = "ಮೈಕ್ ಒತ್ತಿ ಚಿತ್ರದ ಬಗ್ಗೆ ಕನ್ನಡದಲ್ಲಿ 15–30 ಸೆಕೆಂಡ್ ಮಾತನಾಡಿ";
}

function openModal() {
  stopActiveAudio();
  editingSceneId = null;
  resetModalFormFields();
  if (modalTitleEl) {
    modalTitleEl.textContent = "ಹೊಸ ಚಿತ್ರ ಮತ್ತು ಧ್ವನಿ ಸೇರಿಸಿ (Add Photo Triplet)";
  }
  addSceneToDatasetBtn.innerHTML = `<span class="kn-text">ಸೇರಿಸಿ (Save Triplet)</span>`;
  addSceneModal.classList.add("open");
  addSceneModal.setAttribute("aria-hidden", "false");
}

function openEditModal(item) {
  stopActiveAudio();
  editingSceneId = item.id;
  resetModalFormFields();

  if (modalTitleEl) {
    modalTitleEl.textContent = `ಚಿತ್ರ ಮತ್ತು ವಿವರಣೆ ಸಂಪಾದಿಸಿ (Edit ${item.id})`;
  }
  addSceneToDatasetBtn.innerHTML = `<span class="kn-text">ಬದಲಾವಣೆ ಉಳಿಸಿ (Save Changes)</span>`;

  studioRegionInput.value = item.region || "";
  studioCategorySelect.value = item.category || "Streets";
  studioSpeakerInput.value = item.speaker_id || "SPK-01";
  studioVerbatimInput.value = item.verbatim_audio_transcript_kn || "";
  studioCaptionInput.value = item.corrected_caption_kn || "";
  recordedDurationSec = item.duration_sec || 18.0;

  const existingAudio = item.custom_wav_url || item.audio_url;
  if (existingAudio) {
    studioAudioPreview.src = existingAudio;
    studioAudioPreview.style.display = "block";
    studioAudioInfo.textContent = `✓ ಪ್ರಸ್ತುತ ಧ್ವನಿ (${recordedDurationSec}s) — ಬೇಕಿದ್ದರೆ ಹೊಸದಾಗಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ`;
  }

  if (item.image_url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
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
    img.src = item.image_url;
  }

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

if (helpScrollBtn) {
  helpScrollBtn.addEventListener("click", () => {
    document.getElementById("howToSection")?.scrollIntoView({ behavior: "smooth" });
  });
}

function blurCanvasRect(x1, y1, x2, y2, regionType = "face") {
  const startX = Math.max(0, Math.floor(x1));
  const startY = Math.max(0, Math.floor(y1));
  const endX = Math.min(uploadCanvas.width, Math.ceil(x2));
  const endY = Math.min(uploadCanvas.height, Math.ceil(y2));
  const w = endX - startX;
  const h = endY - startY;
  if (w <= 4 || h <= 4) return;

  const offCanvas = document.createElement("canvas");
  offCanvas.width = uploadCanvas.width;
  offCanvas.height = uploadCanvas.height;
  offCanvas.getContext("2d").drawImage(uploadCanvas, 0, 0);

  uploadCtx.save();
  uploadCtx.beginPath();
  if (regionType === "face") {
    uploadCtx.ellipse(startX + w / 2, startY + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    uploadCtx.rect(startX, startY, w, h);
  }
  uploadCtx.clip();
  uploadCtx.filter = "blur(18px)";
  uploadCtx.drawImage(offCanvas, 0, 0);
  uploadCtx.restore();
}

async function autoBlurUploadedPhoto() {
  if (!hasUploadedPhoto) return;

  const tempCanvas = document.createElement("canvas");
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(uploadCanvas.width, uploadCanvas.height));
  tempCanvas.width = Math.round(uploadCanvas.width * scale);
  tempCanvas.height = Math.round(uploadCanvas.height * scale);
  tempCanvas.getContext("2d").drawImage(uploadCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
  const rawBase64 = tempCanvas.toDataURL("image/jpeg", 0.78).split(",")[1];

  let blurredCount = 0;

  if ("FaceDetector" in window) {
    try {
      const detector = new window.FaceDetector();
      const faces = await detector.detect(uploadCanvas);
      for (const f of faces) {
        const b = f.boundingBox;
        blurCanvasRect(b.x - 10, b.y - 10, b.x + b.width + 10, b.y + b.height + 10);
        blurredCount++;
      }
    } catch (_) {}
  }

  const regions = await detectFacesAndPlates({
    imageBase64: rawBase64,
    imageMime: "image/jpeg"
  });

  for (const r of regions) {
    const box = Array.isArray(r) ? r : r?.box_2d;
    const rType = r?.type === "plate" ? "plate" : "face";
    if (Array.isArray(box) && box.length === 4) {
      const [ymin, xmin, ymax, xmax] = box;
      const x1 = (xmin / 1000) * uploadCanvas.width - 6;
      const y1 = (ymin / 1000) * uploadCanvas.height - 6;
      const x2 = (xmax / 1000) * uploadCanvas.width + 6;
      const y2 = (ymax / 1000) * uploadCanvas.height + 6;
      blurCanvasRect(x1, y1, x2, y2, rType);
      blurredCount++;
    }
  }

  if (blurredCount > 0) {
    showToast(`🔒 ಮುಖ / ನಂಬರ್ ಪ್ಲೇಟ್ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಬ್ಲರ್ ಮಾಡಲಾಗಿದೆ (${blurredCount} blurred)`);
  }
}

imageUploadInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = async () => {
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

      showToast("🔍 ಚಿತ್ರವನ್ನು ಪರಿಶೀಲಿಸಿ ವಿವರಣೆ ಮತ್ತು ಬ್ಲರ್ ರಚಿಸಲಾಗುತ್ತಿದೆ...");
      await Promise.all([
        autoBlurUploadedPhoto(),
        runAudioAndImageTranscription()
      ]);
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
  Culture: ["ಕರ್ನಾಟಕ_ಸಂಸ್ಕೃತಿ", "ಜಾನಪದ_ಕಲೆ", "ಕರಕುಶಲ_ಪರಂಪರೆ", "ದೇಶೀಯ_ಕಲೆ"],
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
      hintText: studioVerbatimInput.value,
      place: studioRegionInput.value,
      category: studioCategorySelect.value
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
  const selectedCategory = studioCategorySelect.value || "Streets";
  const speakerId = studioSpeakerInput.value.trim() || "SPK-01";
  localStorage.setItem("chitra_maathu_speaker_id", speakerId);

  let imageDataUrl = "/photos/CM-KA-001.jpg";
  if (hasUploadedPhoto) {
    try {
      imageDataUrl = uploadCanvas.toDataURL("image/jpeg", 0.92);
    } catch (_) {
      const existing = dataset.find((d) => d.id === editingSceneId);
      if (existing?.image_url) imageDataUrl = existing.image_url;
    }
  } else if (editingSceneId) {
    const existing = dataset.find((d) => d.id === editingSceneId);
    if (existing?.image_url) imageDataUrl = existing.image_url;
  }

  if (editingSceneId) {
    const idx = dataset.findIndex((d) => d.id === editingSceneId);
    if (idx !== -1) {
      const prev = dataset[idx];
      const updatedTags =
        lastAnnotatedData?.tags_kn && lastAnnotatedData.tags_kn.length
          ? lastAnnotatedData.tags_kn
          : prev.tags_kn || CATEGORY_DEFAULT_TAGS_KN[selectedCategory];

      const cleanTitle = finalCaption.replace(/\.$/, "").split(/\s+/).slice(0, 7).join(" ");
      dataset[idx] = {
        ...prev,
        title_kn: lastAnnotatedData?.title_kn || (finalCaption !== prev.corrected_caption_kn ? cleanTitle : prev.title_kn),
        title_en: lastAnnotatedData?.title_en || prev.title_en,
        region: studioRegionInput.value.trim() || prev.region || "ಮೈಸೂರು (Mysuru)",
        category: selectedCategory,
        category_kn: CATEGORY_LABELS_KN[selectedCategory] || selectedCategory,
        speaker_id: speakerId,
        duration_sec: recordedDurationSec || prev.duration_sec || 18.0,
        verbatim_audio_transcript_kn: verbatim || finalCaption,
        corrected_caption_kn: finalCaption,
        transliteration_en: lastAnnotatedData?.transliteration_en || prev.transliteration_en || finalCaption,
        translation_en: lastAnnotatedData?.translation_en || prev.translation_en,
        tags_kn: updatedTags,
        image_url: imageDataUrl,
        custom_wav_url: recordedStudioWavBlob ? URL.createObjectURL(recordedStudioWavBlob) : prev.custom_wav_url
      };
    }

    const editedId = editingSceneId;
    editingSceneId = null;
    resetModalFormFields();
    resetSearch();
    closeModal();
    showToast(`✅ ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಲಾಗಿದೆ (${editedId} updated)!`);
    return;
  }

  const newId = `CM-KA-${String(dataset.length + 1).padStart(3, "0")}`;
  const curatedTags =
    lastAnnotatedData?.tags_kn && lastAnnotatedData.tags_kn.length
      ? lastAnnotatedData.tags_kn
      : CATEGORY_DEFAULT_TAGS_KN[selectedCategory] || ["ಕರ್ನಾಟಕ_ಸಂಸ್ಕೃತಿ", "ಜನಜೀವನ_ದೃಶ್ಯ"];

  const cleanTitle = finalCaption.replace(/\.$/, "").split(/\s+/).slice(0, 7).join(" ");
  const newEntry = {
    id: newId,
    title_kn: lastAnnotatedData?.title_kn || cleanTitle,
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

  resetModalFormFields();
  dataset.unshift(newEntry);
  resetSearch();
  closeModal();

  showToast(`✅ ಟ್ರಿಪ್ಲೆಟ್ ${newId} ಸೇರಿಸಲಾಗಿದೆ!`);
});

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

updateStatusText(false);
renderScenesGrid(currentResults, false);
