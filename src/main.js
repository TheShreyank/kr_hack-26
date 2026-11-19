import { SEED_DATASET } from "./data/seedDataset.js";
import { Wav16kRecorder, blobToBase64 } from "./utils/wavEncoder.js";
import { searchScenes, generateSceneCaption } from "./utils/geminiService.js";

let dataset = [...SEED_DATASET];
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

// Modal State
let isStudioRecording = false;
let studioWavRecorder = null;
let studioSpeechRecognition = null;
let recordedStudioWavBlob = null;
let uploadedImageDataUrl = "";

// DOM Elements
const searchQueryInput = document.getElementById("searchQueryInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const voiceSearchBtn = document.getElementById("voiceSearchBtn");
const voiceSearchText = document.getElementById("voiceSearchText");
const runSearchBtn = document.getElementById("runSearchBtn");
const showAllBtn = document.getElementById("showAllBtn");
const searchStatusText = document.getElementById("searchStatusText");
const scenesGrid = document.getElementById("scenesGrid");
const exportJsonBtn = document.getElementById("exportJsonBtn");

// Modal Elements
const addSceneModal = document.getElementById("addSceneModal");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeAddModalBtn = document.getElementById("closeAddModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const imageUploadInput = document.getElementById("imageUploadInput");
const previewImage = document.getElementById("previewImage");
const uploadPlaceholder = document.getElementById("uploadPlaceholder");

const studioRecordBtn = document.getElementById("studioRecordBtn");
const studioAudioInfo = document.getElementById("studioAudioInfo");
const studioAudioPreview = document.getElementById("studioAudioPreview");
const studioRegionInput = document.getElementById("studioRegionInput");
const studioVerbatimInput = document.getElementById("studioVerbatimInput");
const studioCaptionInput = document.getElementById("studioCaptionInput");
const autoCaptionBtn = document.getElementById("autoCaptionBtn");
const addSceneToDatasetBtn = document.getElementById("addSceneToDatasetBtn");

const toastBanner = document.getElementById("toastBanner");

function showToast(message) {
  toastBanner.textContent = message;
  toastBanner.classList.add("show");
  setTimeout(() => {
    toastBanner.classList.remove("show");
  }, 3200);
}

// Reliable Audio Playback (Plays native Kannada MP3 / recorded WAV, with guaranteed fallback)
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
  // If clicking the already-playing button, stop it
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

// Render Photo Gallery Grid
function renderScenesGrid(results, isFiltered = false) {
  stopActiveAudio();
  scenesGrid.innerHTML = "";

  if (results.length === 0) {
    scenesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-subtle);">
        <h3 class="kn-text" style="margin-bottom: 0.4rem;">ಯಾವುದೇ ಹೊಂದಾಣಿಕೆಯ ಚಿತ್ರಗಳು ಕಂಡುಬಂದಿಲ್ಲ</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Try searching for “ಹಳದಿ ಹೂಮಾಲೆ”, “ದೋಸೆ ಕಾಫಿ”, “ಹಂಪಿ ರಥ”, or “ಯಕ್ಷಗಾನ”.</p>
      </div>
    `;
    return;
  }

  for (const entry of results) {
    const { item, score, matchedTokens = [] } = entry;
    const matchedSet = new Set(matchedTokens);

    const card = document.createElement("article");
    card.className = "scene-card";

    const scoreBadgeHtml = isFiltered
      ? `<span class="badge-pill badge-score">${Math.round(score * 100)}% ಹೊಂದಾಣಿಕೆ</span>`
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
          ${scoreBadgeHtml}
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
      </div>
    `;

    const playBtn = card.querySelector(".listen-caption-btn");
    playBtn.addEventListener("click", () => {
      playSceneAudio(item, playBtn);
    });

    scenesGrid.appendChild(card);
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
  showAllBtn.style.display = cleanQ ? "inline-flex" : "none";

  const isFiltered = Boolean(cleanQ);
  currentResults = response.results;

  searchStatusText.innerHTML = isFiltered
    ? `<strong>“${cleanQ}”</strong> — <strong>${currentResults.length}</strong> ಚಿತ್ರಗಳು ಕಂಡುಬಂದಿವೆ`
    : `ಎಲ್ಲಾ ಚಿತ್ರಗಳು (${dataset.length})`;

  renderScenesGrid(currentResults, isFiltered);
}

function resetSearch() {
  searchQueryInput.value = "";
  clearSearchBtn.style.display = "none";
  showAllBtn.style.display = "none";
  currentResults = dataset.map((item) => ({ item, score: 1, matchedTokens: [] }));
  searchStatusText.textContent = `ಎಲ್ಲಾ ಚಿತ್ರಗಳು (${dataset.length})`;
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

// Voice Search Button
voiceSearchBtn.addEventListener("click", async () => {
  if (!isVoiceSearching) {
    try {
      stopActiveAudio();
      isVoiceSearching = true;
      voiceSearchBtn.classList.add("recording");
      voiceSearchText.textContent = "ನಿಲ್ಲಿಸಿ (Stop)";

      searchWavRecorder = new Wav16kRecorder();
      await searchWavRecorder.start();

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

      showToast("🎙️ ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ... (Speak now)");
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
        queryText: searchQueryInput.value,
        audioBase64
      });
    }
  }
});

// ======================================================
// ADD PHOTO & VOICE MODAL
// ======================================================

function openModal() {
  stopActiveAudio();
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

imageUploadInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    uploadedImageDataUrl = reader.result;
    previewImage.src = uploadedImageDataUrl;
    previewImage.style.display = "block";
    uploadPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
});

studioRecordBtn.addEventListener("click", async () => {
  if (!isStudioRecording) {
    try {
      isStudioRecording = true;
      studioRecordBtn.classList.add("recording");
      studioRecordBtn.innerHTML = `⏹️ <span class="kn-text">ನಿಲ್ಲಿಸಿ (Stop)</span>`;
      studioAudioInfo.textContent = "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ... ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಿ";

      studioWavRecorder = new Wav16kRecorder();
      await studioWavRecorder.start();

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
      studioRecordBtn.innerHTML = `🎙️ <span class="kn-text">ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ (Record)</span>`;
      showToast("⚠️ ಮೈಕ್ರೊಫೋನ್ ಲಭ್ಯವಿಲ್ಲ.");
    }
  } else {
    isStudioRecording = false;
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
        studioAudioPreview.src = URL.createObjectURL(result.wavBlob);
        studioAudioPreview.style.display = "block";
        studioAudioInfo.textContent = `✓ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಆಗಿದೆ (${result.durationSec}s)`;
      }
    }
  }
});

autoCaptionBtn.addEventListener("click", async () => {
  autoCaptionBtn.disabled = true;
  autoCaptionBtn.textContent = "⏳ ರಚಿಸಲಾಗುತ್ತಿದೆ...";

  try {
    const imageBase64 = uploadedImageDataUrl ? uploadedImageDataUrl.split(",")[1] : null;
    const audioBase64 = recordedStudioWavBlob ? await blobToBase64(recordedStudioWavBlob) : null;

    const annotated = await generateSceneCaption({
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
    showToast("✨ ಕನ್ನಡ ವಿವರಣೆ ಸಿದ್ಧವಾಗಿದೆ!");
  } catch (err) {
    showToast("⚠️ ದಯವಿಟ್ಟು ವಿವರಣೆಯನ್ನು ನಮೂದಿಸಿ.");
  } finally {
    autoCaptionBtn.disabled = false;
    autoCaptionBtn.innerHTML = `✨ <span class="kn-text">ಸ್ವಯಂ ವಿವರಣೆ ರಚಿಸಿ (Auto-Caption)</span>`;
  }
});

addSceneToDatasetBtn.addEventListener("click", () => {
  const caption = studioCaptionInput.value.trim();
  const verbatim = studioVerbatimInput.value.trim();

  if (!caption && !verbatim) {
    showToast("⚠️ ದಯವಿಟ್ಟು ಚಿತ್ರದ ಕನ್ನಡ ವಿವರಣೆಯನ್ನು ಬರೆಯಿರಿ.");
    return;
  }

  const finalCaption = caption || verbatim;
  const newId = `CM-KA-${String(dataset.length + 1).padStart(3, "0")}`;

  const newEntry = {
    id: newId,
    title_kn: finalCaption.slice(0, 38),
    title_en: "Karnataka Scene",
    region: studioRegionInput.value.trim() || "ಕರ್ನಾಟಕ",
    spoken_query_example: finalCaption.slice(0, 32),
    verbatim_audio_transcript_kn: verbatim || finalCaption,
    corrected_caption_kn: finalCaption,
    transliteration_en: finalCaption,
    translation_en: "User contributed Karnataka scene.",
    tags_kn: finalCaption
      .replace(/[.,?!]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5),
    tags_en: ["karnataka"],
    image_url:
      uploadedImageDataUrl ||
      "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1400&q=85",
    custom_wav_url: recordedStudioWavBlob ? URL.createObjectURL(recordedStudioWavBlob) : null,
    fallback_theme: { bg1: "#78350f", bg2: "#d97706", icon: "📷", label: finalCaption.slice(0, 24) }
  };

  dataset.unshift(newEntry);
  resetSearch();
  closeModal();

  // Reset modal fields
  studioVerbatimInput.value = "";
  studioCaptionInput.value = "";
  recordedStudioWavBlob = null;
  uploadedImageDataUrl = "";
  previewImage.style.display = "none";
  uploadPlaceholder.style.display = "block";
  studioAudioPreview.style.display = "none";
  studioAudioInfo.textContent = "ಮೈಕ್ ಒತ್ತಿ ಚಿತ್ರದ ಬಗ್ಗೆ ಕನ್ನಡದಲ್ಲಿ ಹೇಳಿ";

  showToast("✅ ಹೊಸ ಚಿತ್ರ ಮತ್ತು ಧ್ವನಿ ವಿವರಣೆಯನ್ನು ಸೇರಿಸಲಾಗಿದೆ!");
});

// Export Dataset JSON
exportJsonBtn.addEventListener("click", () => {
  const exportPayload = {
    challenge: "03 · Chitra-Maathu (ಚಿತ್ರ-ಮಾತು · ಚಿತ್ರ, ಧ್ವನಿ ಮತ್ತು ವಿವರಣೆ)",
    total_records: dataset.length,
    records: dataset.map(({ image_url, custom_wav_url, fallback_theme, ...cleanRecord }) => ({
      ...cleanRecord,
      image_file: `${cleanRecord.id}.jpg`,
      audio_file: `${cleanRecord.id}.wav`
    }))
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chitra_maathu_dataset.json";
  a.click();
  showToast("⬇️ ಡೇಟಾಸೆಟ್ ಡೌನ್‌ಲೋಡ್ ಆಗಿದೆ (chitra_maathu_dataset.json)");
});

// Boot App
renderScenesGrid(currentResults, false);
