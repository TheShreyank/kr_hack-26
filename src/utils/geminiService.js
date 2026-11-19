/**
 * Gemini Multimodal Service for Chitra-Maathu (ಚಿತ್ರ-ಮಾತು)
 * Supports:
 * 1. Direct Kannada Audio (16kHz WAV) + Text Semantic Search over Karnataka scene dataset
 * 2. Multimodal Image (JPEG) + Spoken Audio (WAV) -> Corrected Kannada Caption & Tags
 * 3. Instant Kannada Linguistic Fallback Engine when no API key is configured
 */

const STORAGE_KEY = "chitra_maathu_gemini_key";
const DEFAULT_MODEL = "gemini-2.5-flash";

// Kannada morphological stemmer & synonym expansion for instant offline/hybrid search
const KANNADA_SYNONYM_MAP = {
  "ಹೂಮಾಲೆ": ["ಹೂವು", "ಮಾಲೆ", "ಸೇವಂತಿಗೆ", "ಮಲ್ಲಿಗೆ", "ಹೂವಿನ", "ಹಳದಿ"],
  "ಹೂವು": ["ಹೂಮಾಲೆ", "ಸೇವಂತಿಗೆ", "ಮಲ್ಲಿಗೆ", "ಹೂವಿನ"],
  "ಮಳಿಗೆ": ["ಅಂಗಡಿ", "ಮಾರುಕಟ್ಟೆ", "ಸಂತೆ", "ಜಾತ್ರೆ"],
  "ಅಂಗಡಿ": ["ಮಳಿಗೆ", "ಮಾರುಕಟ್ಟೆ", "ಸಂತೆ", "ಹೋಟೆಲ್", "ದರ್ಶಿನಿ"],
  "ದೋಸೆ": ["ಮಸಾಲೆ ದೋಸೆ", "ತಿಂಡಿ", "ಚಟ್ನಿ", "ದರ್ಶಿನಿ", "ಕಾಫಿ"],
  "ಕಾಫಿ": ["ಫಿಲ್ಟರ್ ಕಾಫಿ", "ಬಿಸಿ", "ದರ್ಶಿನಿ", "ಹೋಟೆಲ್"],
  "ರಥ": ["ಕಲ್ಲಿನ ರಥ", "ಹಂಪಿ", "ದೇವಾಲಯ", "ಶಿಲ್ಪ", "ವಿಜಯನಗರ"],
  "ಹಂಪಿ": ["ಕಲ್ಲಿನ ರಥ", "ವಿಜಯನಗರ", "ದೇವಾಲಯ", "ಸ್ಮಾರಕ"],
  "ಯಕ್ಷಗಾನ": ["ಕಲಾವಿದ", "ವೇಷ", "ಕಿರೀಟ", "ಕರಾವಳಿ", "ನೃತ್ಯ", "ಕಲೆ"],
  "ಗೊಂಬೆ": ["ಗೊಂಬೆಗಳು", "ಚನ್ನಪಟ್ಟಣ", "ಮರದ ಗೊಂಬೆ", "ಆಟಿಕೆ", "ಕರಕುಶಲ"],
  "ಗೊಂಬೆಗಳು": ["ಗೊಂಬೆ", "ಚನ್ನಪಟ್ಟಣ", "ಮರದ ಗೊಂಬೆ", "ಆಟಿಕೆ"],
  "ತರಕಾರಿ": ["ಸಂತೆ", "ಸೊಪ್ಪು", "ಹಸಿರು", "ರೈತರು", "ಮಾರುಕಟ್ಟೆ"]
};

const STOP_WORDS_KN = new Set([
  "ತೋರಿಸು", "ತೋರಿಸಿ", "ಹುಡುಕು", "ಚಿತ್ರ", "ಫೋಟೋ", "ಇರುವ", "ಇರೋ", "ಮತ್ತು", "ಮತ್ತೆ", "ಒಂದು", "ಇಲ್ಲಿ", "ನನಗೆ", "ಬೇಕು"
]);

export function getSavedApiKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function saveApiKey(key) {
  const trimmed = (key || "").trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Local linguistic Kannada + English semantic search scorer
 */
export function localKannadaSemanticSearch(queryText, dataset) {
  const cleanQuery = (queryText || "").trim();
  if (!cleanQuery) {
    return {
      transcribedQuery: "",
      engine: "all",
      results: dataset.map((item) => ({ item, score: 1, matchedTokens: [], reason_kn: "" }))
    };
  }

  const rawTokens = cleanQuery
    .replace(/[.,?!""'']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS_KN.has(t));

  // Expand query tokens with Kannada synonyms
  const expandedTokens = new Set(rawTokens);
  for (const token of rawTokens) {
    for (const [key, syns] of Object.entries(KANNADA_SYNONYM_MAP)) {
      if (token.includes(key) || key.includes(token)) {
        expandedTokens.add(key);
        syns.forEach((s) => expandedTokens.add(s));
      }
    }
  }

  const scored = dataset.map((item) => {
    const corpusKn = [
      item.title_kn,
      item.corrected_caption_kn,
      item.verbatim_audio_transcript_kn,
      item.region,
      ...(item.tags_kn || [])
    ].join(" ");

    const corpusEn = [
      item.title_en,
      item.translation_en,
      item.transliteration_en,
      ...(item.tags_en || [])
    ]
      .join(" ")
      .toLowerCase();

    let score = 0;
    const matched = new Set();

    // Direct token match
    for (const token of rawTokens) {
      const lower = token.toLowerCase();
      if (corpusKn.includes(token)) {
        score += 35;
        matched.add(token);
      } else if (corpusEn.includes(lower)) {
        score += 28;
        matched.add(token);
      } else if (token.length >= 3) {
        const stem = token.slice(0, Math.max(2, token.length - 2));
        if (corpusKn.includes(stem)) {
          score += 20;
          matched.add(token);
        }
      }
    }

    // Expanded synonym match
    for (const syn of expandedTokens) {
      if (!rawTokens.includes(syn) && corpusKn.includes(syn)) {
        score += 10;
        matched.add(syn);
      }
    }

    const normalizedScore = Math.min(0.99, score / Math.max(40, rawTokens.length * 32));
    return {
      item,
      score: Number(normalizedScore.toFixed(2)),
      matchedTokens: Array.from(matched),
      reason_kn:
        matched.size > 0
          ? `ಹೊಂದಾಣಿಕೆಯಾದ ಪದಗಳು: ${Array.from(matched).slice(0, 4).join(", ")}`
          : "ಭಾಷಾ ಸಾಮ್ಯತೆಯ ಆಧಾರದ ಮೇಲೆ"
    };
  });

  const filtered = scored
    .filter((entry) => entry.score > 0.08)
    .sort((a, b) => b.score - a.score);

  return {
    transcribedQuery: cleanQuery,
    engine: "Kannada Linguistic Hybrid Engine",
    results: filtered
  };
}

/**
 * Performs Gemini Multimodal Search (supports both text query and 16kHz WAV audio base64)
 */
export async function searchWithGemini({ queryText = "", audioBase64 = null, dataset }) {
  const apiKey = getSavedApiKey();

  if (!apiKey) {
    return localKannadaSemanticSearch(queryText, dataset);
  }

  const catalogSummary = dataset.map((d) => ({
    id: d.id,
    title_kn: d.title_kn,
    caption_kn: d.corrected_caption_kn,
    tags_kn: d.tags_kn,
    region: d.region,
    translation_en: d.translation_en
  }));

  const systemInstruction = `You are Chitra-Maathu (ಚಿತ್ರ-ಮಾತು), a Kannada multimodal voice-to-image retrieval engine built for Modalapada 2.0.
Given a user's query (either as spoken Kannada audio or Kannada/English text) and a catalog of Karnataka cultural scenes:
1. If audio is provided, transcribe the spoken Kannada query accurately into UTF-8 Kannada in "transcribedQuery". If text is provided, keep "transcribedQuery" as the query text.
2. Rank the matching scenes from the catalog by semantic relevance (score 0.15 to 0.99).
3. Return ONLY valid JSON with this structure:
{
  "transcribedQuery": "ಕನ್ನಡದ ಪ್ರಶ್ನೆ",
  "matches": [
    {
      "id": "CM-KA-001",
      "score": 0.96,
      "matchedTokens": ["ಹಳದಿ", "ಹೂಮಾಲೆ", "ಮಳಿಗೆ"],
      "reason_kn": "ಜಾತ್ರೆಯ ಹೂವಿನ ಮಳಿಗೆಯಲ್ಲಿ ಹಳದಿ ಹೂಮಾಲೆಗಳಿವೆ"
    }
  ]
}`;

  const parts = [];
  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/wav",
        data: audioBase64
      }
    });
  }
  parts.push({
    text: `User Query Text (if any): "${queryText}"\n\nScene Catalog JSON:\n${JSON.stringify(catalogSummary)}`
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.15
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawJson);

    const byId = new Map(dataset.map((d) => [d.id, d]));
    const results = (parsed.matches || [])
      .filter((m) => byId.has(m.id))
      .map((m) => ({
        item: byId.get(m.id),
        score: m.score || 0.85,
        matchedTokens: m.matchedTokens || [],
        reason_kn: m.reason_kn || "ಜೆಮಿನಿ ಮಲ್ಟಿಮೋಡಲ್ ಹೊಂದಾಣಿಕೆ"
      }));

    return {
      transcribedQuery: parsed.transcribedQuery || queryText,
      engine: `Gemini Multimodal (${DEFAULT_MODEL})`,
      results
    };
  } catch (err) {
    console.warn("Falling back to local Kannada engine:", err);
    return localKannadaSemanticSearch(queryText, dataset);
  }
}

/**
 * Generates or refines a Kannada scene annotation from an Image (JPEG base64) + optional Voice (16kHz WAV base64)
 */
export async function generateCaptionWithGemini({ imageBase64, imageMime = "image/jpeg", audioBase64 = null, hintText = "" }) {
  const apiKey = getSavedApiKey();

  if (!apiKey) {
    // Intelligent offline draft refinement if no API key is entered yet
    const baseText = hintText.trim() || "ಕರ್ನಾಟಕದ ಸಾಂಸ್ಕೃತಿಕ ದೃಶ್ಯ ಮತ್ತು ಜನಜೀವನದ ಚಿತ್ರಣ.";
    return {
      title_kn: baseText.slice(0, 36),
      title_en: "Karnataka Cultural Scene",
      verbatim_audio_transcript_kn: baseText,
      corrected_caption_kn: baseText.endsWith(".") ? baseText : `${baseText}.`,
      transliteration_en: "Karnatakada saamskritika drishya mattu janajeevanada chitrana.",
      translation_en: "A cultural scene depicting everyday life in Karnataka.",
      tags_kn: ["ಕರ್ನಾಟಕ", "ಸಂಸ್ಕೃತಿ", "ಜನಜೀವನ", "ಚಿತ್ರ"],
      tags_en: ["karnataka", "culture", "scene"],
      engine: "Local Kannada Formatter (Add Gemini API Key for Live Vision+Audio AI)"
    };
  }

  const parts = [];
  if (imageBase64) {
    parts.push({
      inlineData: {
        mimeType: imageMime,
        data: imageBase64
      }
    });
  }
  if (audioBase64) {
    parts.push({
      inlineData: {
        mimeType: "audio/wav",
        data: audioBase64
      }
    });
  }
  parts.push({
    text: `Analyze this Karnataka image and optional spoken Kannada voice recording (speaker hint: "${hintText}").
Return ONLY valid JSON in UTF-8 Kannada and English:
{
  "title_kn": "ಚಿಕ್ಕ ಕನ್ನಡ ಶೀರ್ಷಿಕೆ",
  "title_en": "Short English Title",
  "verbatim_audio_transcript_kn": "ಆಡಿಯೋದಲ್ಲಿ ಹೇಳಿದ ಯಥಾವತ್ ಕನ್ನಡ ವಾಕ್ಯ (ಅಥವಾ ಚಿತ್ರದ ಆಡುಮಾತಿನ ವಿವರಣೆ)",
  "corrected_caption_kn": "ವ್ಯಾಕರಣಬದ್ಧವಾದ, ಸ್ಪಷ್ಟ ಮತ್ತು ಸುಂದರ ಪ್ರಮಾಣ ಕನ್ನಡದ ಚಿತ್ರ ವಿವರಣೆ.",
  "transliteration_en": "Romanized English transliteration of corrected_caption_kn",
  "translation_en": "Accurate English translation of corrected_caption_kn",
  "tags_kn": ["ಟ್ಯಾಗ್೧", "ಟ್ಯಾಗ್೨", "ಟ್ಯಾಗ್೩", "ಟ್ಯಾಗ್೪", "ಟ್ಯಾಗ್೫"],
  "tags_en": ["tag1", "tag2", "tag3", "tag4"]
}`
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API Error (${response.status})`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const parsed = JSON.parse(rawJson);

  return {
    ...parsed,
    engine: `Gemini Multimodal (${DEFAULT_MODEL})`
  };
}
