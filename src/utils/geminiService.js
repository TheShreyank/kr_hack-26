const MODEL_CANDIDATES = [
  "gemini-3-flash-preview",
  "gemma-4-31b-it",
  "gemini-flash-latest"
];

const KANNADA_SYNONYM_MAP = {
  "ದೇವಸ್ಥಾನ": ["ದೇವಾಲಯ", "ಜಾತ್ರೆ", "ಹೂವಿನ", "ಹೂಮಾಲೆ", "ಮಳಿಗೆ", "ರಥಬೀದಿ", "ಉಡುಪಿ"],
  "ಹೂಮಾಲೆ": ["ಹೂವು", "ಮಾಲೆ", "ಸೇವಂತಿಗೆ", "ಮಲ್ಲಿಗೆ", "ಹೂವಿನ", "ಹಳದಿ", "ದೇವಸ್ಥಾನ", "ದೇವರಾಜ"],
  "ಹೂವು": ["ಹೂಮಾಲೆ", "ಸೇವಂತಿಗೆ", "ಮಲ್ಲಿಗೆ", "ಹೂವಿನ", "ಮಳಿಗೆ", "ದೇವರಾಜ"],
  "ಮಳಿಗೆ": ["ಅಂಗಡಿ", "ಮಾರುಕಟ್ಟೆ", "ಸಂತೆ", "ಜಾತ್ರೆ", "ದೇವರಾಜ", "ಕಮರ್ಷಿಯಲ್"],
  "ಅಂಗಡಿ": ["ಮಳಿಗೆ", "ಮಾರುಕಟ್ಟೆ", "ಸಂತೆ", "ಹೋಟೆಲ್", "ದರ್ಶಿನಿ", "ಪಾನಿಪೂರಿ", "ತಿಂಡಿ ಬೀದಿ"],
  "ಪಾನಿಪೂರಿ": ["ಚಾಟ್ಸ್", "ಕಾಲೇಜ್", "ಕಾಲೇಜಿನ", "ಕ್ಯಾಂಪಸ್", "ಅಂಗಡಿ", "ತಿಂಡಿ", "ತಿಂಡಿ ಬೀದಿ"],
  "ಕಾಲೇಜ್": ["ಕಾಲೇಜಿನ", "ಕ್ಯಾಂಪಸ್", "ಪಾನಿಪೂರಿ", "ರಾಮಯ್ಯ", "ವಿದ್ಯಾರ್ಥಿಗಳು", "ಅಪೆಕ್ಸ್", "ಕಟ್ಟಡ"],
  "ರಾಮಯ್ಯ": ["ಕಾಲೇಜು", "ಕ್ಯಾಂಪಸ್", "ವಿದ್ಯಾರ್ಥಿಗಳು", "ಮತ್ತಿಕೆರೆ", "ಅಪೆಕ್ಸ್ ಬ್ಲಾಕ್", "ಕಟ್ಟಡ"],
  "ಆಟೋ": ["ಆಟೋ ರಿಕ್ಷಾ", "ಆಟೋ ಚಾಲಕ", "ರಸ್ತೆ", "ಸಂಚಾರ", "ನಮ್ಮ ಯಾತ್ರಿ", "ಬೆಂಗಳೂರು"],
  "ಬಸ್ಸು": ["ಬಿಎಂಟಿಸಿ", "ಬೆಂಗಳೂರು ಸಾರಿಗೆ", "ರಸ್ತೆ", "ಪ್ರಯಾಣಿಕರು"],
  "ಅರಮನೆ": ["ಮೈಸೂರು", "ದೀಪಾಲಂಕಾರ", "ದೀಪಗಳಿಂದ", "ಬೆಳಗಿದ", "ದಸರಾ", "ಕಟ್ಟಡ"],
  "ದೀಪಾಲಂಕಾರ": ["ದೀಪಗಳಿಂದ", "ಬೆಳಗಿದ", "ಅರಮನೆ", "ಮೈಸೂರು", "ದಸರಾ"],
  "ದೋಸೆ": ["ಮಸಾಲೆ ದೋಸೆ", "ಅವರೆಬೇಳೆ", "ತಿಂಡಿ", "ತಿಂಡಿ ಬೀದಿ", "ವಿವಿ ಪುರಂ", "ಆಹಾರ"],
  "ಬಾದಾಮಿ": ["ಬಾದಾಮಿ ಹಾಲು", "ಫೇಣಿ", "ತಿಂಡಿ ಬೀದಿ", "ಹಾಲು", "ಸಿಹಿ"],
  "ರಥ": ["ಕಲ್ಲಿನ ರಥ", "ಹಂಪಿ", "ಉಡುಪಿ", "ರಥಬೀದಿ", "ದೇವಾಲಯ", "ತೇರು"],
  "ಹಂಪಿ": ["ಕಲ್ಲಿನ ರಥ", "ವಿಜಯನಗರ", "ದೇವಾಲಯ", "ಸ್ಮಾರಕ", "ಕಟ್ಟಡ"],
  "ಉಡುಪಿ": ["ರಥಬೀದಿ", "ರಥ", "ದೇವಸ್ಥಾನ", "ಕರಾವಳಿ", "ಮಲ್ಪೆ", "ಮಣಿಪಾಲ", "ಕಡಲತೀರ"],
  "ಮಣಿಪಾಲ": ["ಉಡುಪಿ", "ಮಲ್ಪೆ", "ಕಡಲತೀರ", "ಸಮುದ್ರ", "ಮೀನುಗಾರಿಕೆ", "ದೋಣಿ", "ಹಸ್ತಶಿಲ್ಪ"],
  "ಮಲ್ಪೆ": ["ಕಡಲತೀರ", "ಸಮುದ್ರ", "ಮೀನುಗಾರರು", "ದೋಣಿ", "ಉಡುಪಿ", "ಮಣಿಪಾಲ"],
  "ಕಡಲತೀರ": ["ಬೀಚ್", "ಸಮುದ್ರ", "ಮಲ್ಪೆ", "ಮಣಿಪಾಲ", "ಉಡುಪಿ", "ದೋಣಿ", "ಕರಾವಳಿ"],
  "ಕೊಡಗು": ["ಮಡಿಕೇರಿ", "ಕಾಫಿ", "ತೋಟ", "ಬೆಟ್ಟ", "ಮಂಜು", "ಪ್ರಕೃತಿ"],
  "ಮಡಿಕೇರಿ": ["ಕೊಡಗು", "ಕಾಫಿ", "ತೋಟ", "ಮಂಜು", "ಪ್ರಕೃತಿ"],
  "ವಿಜಯಪುರ": ["ಬಿಜಾಪುರ", "ಗೋಳಗುಮ್ಮಟ", "ಸ್ಮಾರಕ", "ಉತ್ತರ ಕರ್ನಾಟಕ", "ಕಟ್ಟಡ"],
  "ಬಿಜಾಪುರ": ["ವಿಜಯಪುರ", "ಗೋಳಗುಮ್ಮಟ", "ಸ್ಮಾರಕ", "ಉತ್ತರ ಕರ್ನಾಟಕ", "ಕಟ್ಟಡ"],
  "ಬೀದರ್": ["ಕೋಟೆ", "ಸ್ಮಾರಕ", "ಕಟ್ಟಡ", "ಉತ್ತರ ಕರ್ನಾಟಕ", "ದ್ವಾರ"],
  "ಕಲಬುರಗಿ": ["ಗುಲ್ಬರ್ಗಾ", "ಕೋಟೆ", "ಶರಣಬಸವೇಶ್ವರ", "ಉತ್ತರ ಕರ್ನಾಟಕ"],
  "ಹುಬ್ಬಳ್ಳಿ": ["ಧಾರವಾಡ", "ಚನ್ನಮ್ಮ", "ಬಸ್ಸು", "ಮಾರುಕಟ್ಟೆ", "ಉತ್ತರ ಕರ್ನಾಟಕ"],
  "ಮಂಗಳೂರು": ["ಪಿಲಿಕುಳ", "ಪ್ರಕೃತಿ", "ಹಸಿರು", "ಮರಗಳು", "ದಕ್ಷಿಣ ಕನ್ನಡ", "ಕರಾವಳಿ"],
  "ಗೊಂಬೆ": ["ಗೊಂಬೆಗಳು", "ಚನ್ನಪಟ್ಟಣ", "ಮರದ ಗೊಂಬೆಗಳು", "ಕಲಾವಿದ", "ಕರಕುಶಲ"],
  "ಗೊಂಬೆಗಳು": ["ಗೊಂಬೆ", "ಚನ್ನಪಟ್ಟಣ", "ಮರದ ಗೊಂಬೆಗಳು", "ಕಲಾವಿದ"],
  "ಜೋಗ": ["ಜಲಪಾತ", "ಶಿವಮೊಗ್ಗ", "ಶರಾವತಿ", "ಸಾಗರ", "ಮಲೆನಾಡು", "ಪ್ರಕೃತಿ", "ಕಾಮನಬಿಲ್ಲು"],
  "ಜಲಪಾತ": ["ಜೋಗ", "ಶಿವಮೊಗ್ಗ", "ಶರಾವತಿ", "ಸಾಗರ", "ಗೋಕಾಕ್", "ಅಬ್ಬಿ", "ಶಿವನಸಮುದ್ರ", "ಗಗನಚುಕ್ಕಿ", "ಭರಚುಕ್ಕಿ", "ಪ್ರಕೃತಿ"],
  "ಶಿವಮೊಗ್ಗ": ["ಜೋಗ", "ಜಲಪಾತ", "ಶರಾವತಿ", "ಮಲೆನಾಡು", "ಸಾಗರ", "ಪ್ರಕೃತಿ", "ಕಾಡು"],
  "ಶರಾವತಿ": ["ಶಿವಮೊಗ್ಗ", "ಜೋಗ", "ಜಲಪಾತ", "ನದಿ", "ಹಿನ್ನೀರು", "ಮಲೆನಾಡು"],
  "ಬಾಗಲಕೋಟೆ": ["ಬಾದಾಮಿ", "ಪಟ್ಟದಕಲ್ಲು", "ಐಹೊಳೆ", "ಗುಹಾಂತರ", "ಚಾಲುಕ್ಯ", "ಅಗಸ್ತ್ಯ"],
  "ಬೆಳಗಾವಿ": ["ಗೋಕಾಕ್", "ಸುವರ್ಣ ವಿಧಾನಸೌಧ", "ಕಮಲ ಬಸದಿ", "ಘಟಪ್ರಭಾ"],
  "ಧಾರವಾಡ": ["ಹುಬ್ಬಳ್ಳಿ", "ಪೇಡಾ", "ಜೋಳದ ರೊಟ್ಟಿ", "ಎಣ್ಣೆಗಾಯಿ", "ಉತ್ತರ ಕರ್ನಾಟಕ"],
  "ಗದಗ": ["ಲಕ್ಕುಂಡಿ", "ಕಲ್ಯಾಣಿ", "ತ್ರಿಕೂಟೇಶ್ವರ", "ಮೆಟ್ಟಿಲುಬಾವಿ"],
  "ಹಾವೇರಿ": ["ಬ್ಯಾಡಗಿ", "ಮೆಣಸಿನಕಾಯಿ", "ಡೊಳ್ಳು ಕುಣಿತ", "ಜಾನಪದ"],
  "ದಾವಣಗೆರೆ": ["ಬೆಣ್ಣೆ ದೋಸೆ", "ಸಂತೆಬೆನ್ನೂರು", "ಪುಷ್ಕರಣಿ", "ದೋಸೆ"],
  "ಬಳ್ಳಾರಿ": ["ಬಳ್ಳಾರಿ ಕೋಟೆ", "ಏಕಶಿಲಾ ಬೆಟ್ಟ", "ಕೋಟೆ"],
  "ಕೊಪ್ಪಳ": ["ಇಟಗಿ", "ಮಹಾದೇವ", "ತುಂಗಭದ್ರಾ", "ಮುನಿರಾಬಾದ್", "ಜಲಾಶಯ"],
  "ರಾಯಚೂರು": ["ರಾಯಚೂರು ಕೋಟೆ", "ಬಿಸಿಲ ನಾಡು", "ಕೋಟೆ"],
  "ಯಾದಗಿರಿ": ["ಯಾದಗಿರಿ ಕೋಟೆ", "ಗಿರಿಕೋಟೆ", "ಕೋಟೆ"],
  "ಯಕ್ಷಗಾನ": ["ಕರಾವಳಿ", "ಉತ್ತರ ಕನ್ನಡ", "ಕಿರೀಟ", "ವೇಷಭೂಷಣ", "ಜಾನಪದ"],
  "ಗೋಕರ್ಣ": ["ಓಂ ಬೀಚ್", "ಉತ್ತರ ಕನ್ನಡ", "ಕಡಲತೀರ", "ಸಮುದ್ರ"],
  "ಕಂಬಳ": ["ಕೋಣಗಳ", "ಕೆಸರುಗದ್ದೆ", "ದಕ್ಷಿಣ ಕನ್ನಡ", "ತುಳುನಾಡು", "ಮಂಗಳೂರು"],
  "ಹುಲಿವೇಶ": ["ಪಿಲಿ ಯೇಸ", "ಮಂಗಳೂರು", "ದಸರಾ", "ದಕ್ಷಿಣ ಕನ್ನಡ"],
  "ಚಿಕ್ಕಮಗಳೂರು": ["ಮುಳ್ಳಯ್ಯನಗಿರಿ", "ಕುದುರೆಮುಖ", "ಫಿಲ್ಟರ್ ಕಾಫಿ", "ಕಾಫಿ", "ಪಶ್ಚಿಮ ಘಟ್ಟ"],
  "ಹಾಸನ": ["ಬೇಲೂರು", "ಹಳೇಬೀಡು", "ಶ್ರವಣಬೆಳಗೊಳ", "ಹೊಯ್ಸಳ", "ಚೆನ್ನಕೇಶವ", "ಬಾಹುಬಲಿ"],
  "ಚಿತ್ರದುರ್ಗ": ["ಕಲ್ಲಿನ ಕೋಟೆ", "ಮದಕರಿ ನಾಯಕ", "ವಾಣಿವಿಲಾಸ ಸಾಗರ", "ಕೋಟೆ"],
  "ತುಮಕೂರು": ["ದೇವರಾಯನದುರ್ಗ", "ರಾಗಿ ಮುದ್ದೆ", "ಬಸ್ಸಾರು"],
  "ಮಂಡ್ಯ": ["ರಂಗನತಿಟ್ಟು", "ಮದ್ದೂರು ವಡೆ", "ಶಿವನಸಮುದ್ರ", "ಗಗನಚುಕ್ಕಿ", "ಕಾವೇರಿ"],
  "ಚಾಮರಾಜನಗರ": ["ಬಂಡೀಪುರ", "ಕಾಡಾನೆ", "ಭರಚುಕ್ಕಿ", "ಜಲಪಾತ", "ಕೊಳ್ಳೇಗಾಲ"],
  "ದಸರಾ": ["ಮೈಸೂರು", "ಜಂಬೂ ಸವಾರಿ", "ಅರಮನೆ", "ಆನೆಗಳು", "ಹುಲಿವೇಶ"]
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

export async function detectFacesAndPlates({ imageBase64, imageMime = "image/jpeg" }) {
  const apiKey = getEnvApiKey();
  if (!apiKey || !imageBase64) return [];

  try {
    const data = await callModelEndpoint(apiKey, {
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: imageMime,
                data: imageBase64
              }
            },
            {
              text: `Analyze this image carefully for privacy blurring.
RULES:
1. First check if there are any CLEARLY IDENTIFIABLE human faces (where facial features like eyes/nose/mouth are clearly visible) OR any READABLE vehicle license/registration number plates (with alphanumeric characters on a vehicle).
2. If the photo shows only buildings, forts, monuments, food, trees, nature, or tiny distant silhouettes where faces/plates are NOT identifiable, you MUST return {"has_sensitive_regions": false, "regions": []}.
3. NEVER box windows, arches, doors, shop signboards, food items, or whole people's bodies. ONLY box the tight face region itself or the tight vehicle number plate rectangle.
4. Only include detections where you are at least 90% confident (confidence >= 0.90).

Return ONLY valid JSON:
{
  "has_sensitive_regions": true,
  "regions": [
    { "box_2d": [ymin, xmin, ymax, xmax], "type": "face", "confidence": 0.96 },
    { "box_2d": [ymin, xmin, ymax, xmax], "type": "plate", "confidence": 0.95 }
  ]
}`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.0
      }
    });

    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(rawJson);
    const rawList = Array.isArray(parsed)
      ? parsed
      : parsed?.has_sensitive_regions === false
      ? []
      : Array.isArray(parsed?.regions)
      ? parsed.regions
      : [];

    return rawList.filter((r) => {
      const box = r?.box_2d;
      if (!Array.isArray(box) || box.length !== 4) return false;
      const [ymin, xmin, ymax, xmax] = box;
      const wNorm = xmax - xmin;
      const hNorm = ymax - ymin;
      const areaFraction = (wNorm * hNorm) / (1000 * 1000);
      const conf = typeof r.confidence === "number" ? r.confidence : 0.9;
      const validType = r.type === "face" || r.type === "plate";
      return validType && conf >= 0.88 && wNorm > 10 && hNorm > 10 && areaFraction < 0.10;
    });
  } catch (err) {
    return [];
  }
}

const MIN_COMPATIBILITY_SCORE = 0.45;

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
    .filter((entry) => entry.score >= MIN_COMPATIBILITY_SCORE)
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
2. Rank only genuinely relevant scenes from the catalog with semantic relevance score between 0.45 and 0.99 (omit weak matches below 0.45).
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
    const rawMatches = parsed.matches || [];
    const results = rawMatches
      .filter((m) => byId.has(m.id))
      .map((m) => ({
        item: byId.get(m.id),
        score: typeof m.score === "number" ? m.score : 0.85,
        matchedTokens: m.matchedTokens || []
      }))
      .filter((entry) => entry.score >= MIN_COMPATIBILITY_SCORE)
      .sort((a, b) => b.score - a.score);

    if (rawMatches.length === 0 && (parsed.transcribedQuery || queryText)) {
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

export async function generateSceneCaption({
  imageBase64,
  imageMime = "image/jpeg",
  audioBase64 = null,
  hintText = "",
  place = "",
  category = ""
}) {
  const apiKey = getEnvApiKey();

  if (!apiKey) {
    const baseText = hintText.trim() || "ಕರ್ನಾಟಕದ ಸಾಂಸ್ಕೃತಿಕ ದೃಶ್ಯ ಮತ್ತು ಜನಜೀವನದ ಚಿತ್ರಣ";
    const cleanTitle = baseText.replace(/\.$/, "").split(/\s+/).slice(0, 7).join(" ");
    return {
      title_kn: cleanTitle,
      title_en: "Karnataka Cultural & Architectural Scene",
      verbatim_audio_transcript_kn: baseText,
      corrected_caption_kn: `${baseText}. ಈ ಚಿತ್ರವು ಕರ್ನಾಟಕದ ಸ್ಥಳೀಯ ಪರಿಸರ, ವಾಸ್ತುಶಿಲ್ಪ ಮತ್ತು ಜನಜೀವನದ ನೈಜ ಸೌಂದರ್ಯವನ್ನು ವಿವರವಾಗಿ ಕಟ್ಟಿಕೊಡುತ್ತದೆ.`,
      transliteration_en: "Karnatakada saamskritika drishya mattu janajeevanada vistrita chitrana.",
      translation_en: "A detailed scene capturing the authentic architecture, surroundings, and everyday cultural atmosphere of Karnataka.",
      tags_kn: ["ಕರ್ನಾಟಕ_ಪರಂಪರೆ", "ಜನಜೀವನ_ದೃಶ್ಯ", "ಸ್ಥಳೀಯ_ಸಂಸ್ಕೃತಿ", "ನೈಜ_ಚಿತ್ರಣ"]
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
    text: `You are transcribing and writing a rich, detailed visual description of a Karnataka photograph for the Chitra-Maathu dataset.
Context: Place/District = "${place}", Category = "${category}", Speaker voice hint = "${hintText}".

Instructions:
1. "verbatim_audio_transcript_kn": If an audio recording (audio/wav) is attached, transcribe the speaker's exact word-for-word spoken Kannada sentence (keep their colloquial/regional speech intact). If no audio is attached, use "${hintText}" or write a natural colloquial spoken sentence for this photo.
2. "corrected_caption_kn": Write a BIGGER, RICH, DETAILED 2-to-3 sentence description (30 to 45 words) in standard literary Kannada (ಪ್ರಮಾಣ ಕನ್ನಡ). Do NOT write a short one-liner! Carefully describe what is visually present in the uploaded photo: the main subject/building/street, architectural or environmental details (stonework, arches, trees, stalls, lighting, sky, colors), the surrounding activity or atmosphere, and its cultural significance in Karnataka.
3. "translation_en": Write a matching rich, detailed 2-to-3 sentence English description (30 to 45 words) that thoroughly describes the visual details, architecture/setting, and atmosphere of the photo.
4. "tags_kn": Generate 4 to 5 meaningful thematic/cultural Kannada hashtags (using underscore for multi-word tags like "ಪಾರಂಪರಿಕ_ವಾಸ್ತುಶಿಲ್ಪ", "ಉತ್ತರ_ಕರ್ನಾಟಕ", "ಐತಿಹಾಸಿಕ_ಕೋಟೆ", "ಬೀದಿ_ಜನಜೀವನ")—never chop random single words out of the voice transcript.

Return ONLY valid JSON in UTF-8 Kannada and English:
{
  "title_kn": "ಸ್ಪಷ್ಟ ಮತ್ತು ಆಕರ್ಷಕ ಕನ್ನಡ ಶೀರ್ಷಿಕೆ",
  "title_en": "Clear and Descriptive English Title",
  "verbatim_audio_transcript_kn": "ಆಡಿಯೋದಲ್ಲಿ ಹೇಳಿದ ಪೂರ್ಣ ಯಥಾವತ್ ಕನ್ನಡ ವಾಕ್ಯ",
  "corrected_caption_kn": "ಚಿತ್ರದ ದೃಶ್ಯಾವಳಿ, ವಾಸ್ತುಶಿಲ್ಪ ಅಥವಾ ಪರಿಸರ, ಬಣ್ಣಗಳು ಮತ್ತು ವಾತಾವರಣವನ್ನು ವಿವರಿಸುವ ೨-೩ ವಾಕ್ಯಗಳ ಸುದೀರ್ಘ ಹಾಗೂ ಸ್ಪಷ್ಟ ಪ್ರಮಾಣ ಕನ್ನಡದ ಚಿತ್ರ ವಿವರಣೆ.",
  "transliteration_en": "Romanized English transliteration of corrected_caption_kn",
  "translation_en": "A rich, detailed 2-3 sentence English description of the visual details, architecture, surroundings, and cultural atmosphere shown in the photograph.",
  "tags_kn": ["ವಿಷಯ_ಟ್ಯಾಗ್೧", "ಸಂಸ್ಕೃತಿ_ಟ್ಯಾಗ್೨", "ಜಿಲ್ಲೆ_ಟ್ಯಾಗ್೩", "ವಾಸ್ತುಶಿಲ್ಪ_ಟ್ಯಾಗ್೪"]
}`
  });

  try {
    const data = await callModelEndpoint(apiKey, {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.25
      }
    });

    const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return JSON.parse(rawJson);
  } catch (err) {
    const baseText = hintText.trim() || "ಕರ್ನಾಟಕದ ಸಾಂಸ್ಕೃತಿಕ ದೃಶ್ಯ ಮತ್ತು ಜನಜೀವನದ ಚಿತ್ರಣ";
    const cleanTitle = baseText.replace(/\.$/, "").split(/\s+/).slice(0, 7).join(" ");
    return {
      title_kn: cleanTitle,
      title_en: "Karnataka Cultural & Architectural Scene",
      verbatim_audio_transcript_kn: baseText,
      corrected_caption_kn: `${baseText}. ಈ ಚಿತ್ರವು ಕರ್ನಾಟಕದ ಸ್ಥಳೀಯ ಪರಿಸರ, ವಾಸ್ತುಶಿಲ್ಪ ಮತ್ತು ಜನಜೀವನದ ನೈಜ ಸೌಂದರ್ಯವನ್ನು ವಿವರವಾಗಿ ಕಟ್ಟಿಕೊಡುತ್ತದೆ.`,
      transliteration_en: "Karnatakada saamskritika drishya mattu janajeevanada vistrita chitrana.",
      translation_en: "A detailed scene capturing the authentic architecture, surroundings, and everyday cultural atmosphere of Karnataka.",
      tags_kn: ["ಕರ್ನಾಟಕ_ಪರಂಪರೆ", "ಜನಜೀವನ_ದೃಶ್ಯ", "ಸ್ಥಳೀಯ_ಸಂಸ್ಕೃತಿ", "ನೈಜ_ಚಿತ್ರಣ"]
    };
  }
}
