// Transcription service with pluggable providers. The default provider is the
// local careless_whisper API (~/code/python/careless_whisper, launchd agent).
// Any base URL can be supplied through VITE_TRANSCRIPTION_API_URL.

// Each provider knows its default base URL/model and how to build the request.
// `buildRequest` returns { url, init }. Both providers reply with { text }.
export const providers = {
  // careless_whisper API: POST {base}/transcribe-text-only?model=... -> { text }
  local: {
    defaultUrl: "http://localhost:8765",
    defaultModel: "base",
    buildRequest({ baseUrl, model, apiKey }, formData) {
      return {
        url: `${baseUrl}/transcribe-text-only?model=${encodeURIComponent(model)}`,
        init: { method: "POST", body: formData, headers: authHeaders(apiKey) },
      };
    },
  },

  // OpenAI-compatible: POST {base}/audio/transcriptions -> { text }
  // Works with OpenAI, Groq, whisper.cpp server, LocalAI, etc.
  openai: {
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "whisper-1",
    buildRequest({ baseUrl, model, apiKey }, formData) {
      formData.append("model", model);
      return {
        url: `${baseUrl}/audio/transcriptions`,
        init: { method: "POST", body: formData, headers: authHeaders(apiKey) },
      };
    },
  },
};

function authHeaders(apiKey) {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

export function resolveConfig(env = import.meta.env) {
  const name = env.VITE_TRANSCRIPTION_PROVIDER || "local";
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown VITE_TRANSCRIPTION_PROVIDER "${name}". Use: ${Object.keys(providers).join(", ")}`
    );
  }
  return {
    provider: name,
    baseUrl: (env.VITE_TRANSCRIPTION_API_URL || provider.defaultUrl).replace(
      /\/+$/,
      ""
    ),
    model: env.VITE_WHISPER_MODEL || provider.defaultModel,
    apiKey: env.VITE_TRANSCRIPTION_API_KEY || "",
  };
}

// Extensions accepted by the API (see allowed_extensions in api.py)
const EXTENSION_BY_MIME = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/flac": "flac",
};

function getExtension(blob) {
  const mime = (blob.type || "").split(";")[0].trim().toLowerCase();
  return EXTENSION_BY_MIME[mime] || "webm";
}

export async function translateAudio(audioBlob) {
  const config = resolveConfig();
  const { baseUrl } = config;

  const formData = new FormData();
  formData.append("file", audioBlob, `audio.${getExtension(audioBlob)}`);

  const { url, init } = providers[config.provider].buildRequest(
    config,
    formData
  );

  let response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`Cannot reach transcription service at ${baseUrl}`);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || body.error?.message || detail;
    } catch {
      // non-JSON error body, keep statusText
    }
    throw new Error(`${response.status} ${detail}`);
  }

  const result = await response.json();
  return typeof result.text === "string" ? result.text.trim() : "";
}
