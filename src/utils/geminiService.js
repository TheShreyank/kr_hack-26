const MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  "gemma-4-31b-it",
  "gemini-flash-latest"
];

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

function getEnvApiKey() {
  return (import.meta.env?.VITE_GEMINI_API_KEY || "").trim();
}

async function callModelEndpoint(apiKey, payload) {
  let lastError = null;
  for (const model of MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status} on ${model}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Request failed");
}

export function localKannadaSemanticSearch(queryText, dataset) {
  const cleanQuery = (queryText || "").trim();
  if (!cleanQuery) {
    return {
      transcribedQuery: "",
      results: dataset.map((item) => ({ item, score: 1, matchedTokens: [] }))
    };
  }

  const rawTokens = cleanQuery
    .replace(/[.,?!""'']/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS_KN.has(t));

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
      matchedTokens: Array.from(matched)
    };
  });

  const filtered = scored
    .filter((entry) => entry.score > 0.08)
    .sort((a, b) => b.score - a.score);

  return {
    transcribedQuery: cleanQuery,
    results: filtered
  };
}

export async function searchScenes({ queryText = "", audioBase64 = null, dataset }) {
  const apiKey = getEnvApiKey();

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

  const systemInstruction = `You are Chitra-Maathu (ಚಿತ್ರ-ಮಾತು), a Kannada voice-to-image retrieval system.
Given a user's query (either as spoken Kannada audio or Kannada/English text) and a catalog of Karnataka scenes:
1. If audio is provided, transcribe the complete spoken Kannada sentence accurately into UTF-8 Kannada in "transcribedQuery" (do not drop words or only pick keywords—write the full sentence spoken by the user). If only text is provided, keep "transcribedQuery" as the query text.
2. Rank the matching scenes from the catalog by semantic relevance (score 0.15 to 0.99).
3. Return ONLY valid JSON:
{
  "transcribedQuery": "ಬಳಕೆದಾರರು ಹೇಳಿದ ಪೂರ್ಣ ಕನ್ನಡ ವಾಕ್ಯ",
  "matches": [
    {
      "id": "CM-KA-001",
      "score": 0.96,
      "matchedTokens": ["ಹಳದಿ", "ಹೂಮಾಲೆ", "ಮಳಿಗೆ"]
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
    text: `Live browser speech draft (may be incomplete): "${queryText}"\n\nScene Catalog JSON:\n${JSON.stringify(catalogSummary)}`
  });

  try {
    const data = await callModelEndpoint(apiKey, {
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.15
      }
    });

    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawJson);

    const byId = new Map(dataset.map((d) => [d.id, d]));
    const results = (parsed.matches || [])
      .filter((m) => byId.has(m.id))
      .map((m) => ({
        item: byId.get(m.id),
        score: m.score || 0.85,
        matchedTokens: m.matchedTokens || []
      }));

    if (results.length === 0 && (parsed.transcribedQuery || queryText)) {
      return localKannadaSemanticSearch(parsed.transcribedQuery || queryText, dataset);
    }

    return {
      transcribedQuery: parsed.transcribedQuery || queryText,
      results
    };
  } catch (err) {
    return localKannadaSemanticSearch(queryText, dataset);
  }
}

export async function generateSceneCaption({ imageBase64, imageMime = "image/jpeg", audioBase64 = null, hintText = "" }) {
  const apiKey = getEnvApiKey();

  if (!apiKey) {
    const baseText = hintText.trim() || "ಕರ್ನಾಟಕದ ಸಾಂಸ್ಕೃತಿಕ ದೃಶ್ಯ ಮತ್ತು ಜನಜೀವನದ ಚಿತ್ರಣ.";
    return {
      title_kn: baseText.slice(0, 36),
      title_en: "Karnataka Cultural Scene",
      verbatim_audio_transcript_kn: baseText,
      corrected_caption_kn: baseText.endsWith(".") ? baseText : `${baseText}.`,
      transliteration_en: "Karnatakada saamskritika drishya mattu janajeevanada chitrana.",
      translation_en: "A cultural scene depicting everyday life in Karnataka.",
      tags_kn: ["ಕರ್ನಾಟಕ", "ಸಂಸ್ಕೃತಿ", "ಜನಜೀವನ"]
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
    text: `You are transcribing and captioning a Karnataka cultural scene for the Chitra-Maathu dataset.
1. If an audio recording (audio/wav) is attached, listen to the ENTIRE recording carefully and write the speaker's COMPLETE word-for-word spoken Kannada sentence in "verbatim_audio_transcript_kn" (do NOT just extract keywords—write the full sentence they spoke, even if it is in regional/colloquial dialect). Use the browser speech hint ("${hintText}") only as a fallback reference.
2. In "corrected_caption_kn", rewrite the spoken description (and visual details from the image if attached) into a complete, grammatically standard, natural Kannada caption sentence (ಪ್ರಮಾಣ ಕನ್ನಡ ವಾಕ್ಯ).
Return ONLY valid JSON in UTF-8 Kannada and English:
{
  "title_kn": "ಚಿಕ್ಕ ಕನ್ನಡ ಶೀರ್ಷಿಕೆ",
  "title_en": "Short English Title",
  "verbatim_audio_transcript_kn": "ಆಡಿಯೋದಲ್ಲಿ ಹೇಳಿದ ಪೂರ್ಣ ಯಥಾವತ್ ಕನ್ನಡ ವಾಕ್ಯ",
  "corrected_caption_kn": "ವ್ಯಾಕರಣಬದ್ಧವಾದ, ಸ್ಪಷ್ಟ ಪ್ರಮಾಣ ಕನ್ನಡದ ಪೂರ್ಣ ಚಿತ್ರ ವಿವರಣೆ.",
  "transliteration_en": "Romanized English transliteration of corrected_caption_kn",
  "translation_en": "Accurate English translation of corrected_caption_kn",
  "tags_kn": ["ಟ್ಯಾಗ್೧", "ಟ್ಯಾಗ್೨", "ಟ್ಯಾಗ್೩", "ಟ್ಯಾಗ್೪"]
}`
  });

  try {
    const data = await callModelEndpoint(apiKey, {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(rawJson);
  } catch (err) {
    const baseText = hintText.trim() || "ಕರ್ನಾಟಕದ ಸಾಂಸ್ಕೃತಿಕ ದೃಶ್ಯ ಮತ್ತು ಜನಜೀವನದ ಚಿತ್ರಣ.";
    return {
      title_kn: baseText.slice(0, 36),
      title_en: "Karnataka Cultural Scene",
      verbatim_audio_transcript_kn: baseText,
      corrected_caption_kn: baseText.endsWith(".") ? baseText : `${baseText}.`,
      transliteration_en: "Karnatakada saamskritika drishya mattu janajeevanada chitrana.",
      translation_en: "A cultural scene depicting everyday life in Karnataka.",
      tags_kn: ["ಕರ್ನಾಟಕ", "ಸಂಸ್ಕೃತಿ", "ಜನಜೀವನ"]
    };
  }
}
