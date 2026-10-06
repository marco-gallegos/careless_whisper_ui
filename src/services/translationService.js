// Transcription service with pluggable providers. The default provider is the
// local careless_whisper API (~/code/python/careless_whisper, launchd agent).
// Any base URL can be supplied through VITE_TRANSCRIPTION_API_URL or the Settings UI.

import { getSettings } from "./settings";

// Each provider knows its default base URL/model and how to build the request.
// `buildRequest` returns { url, init }. Both providers reply with { text }.
export const providers = {
  // careless_whisper API: POST {base}/transcribe-text-only?model=... -> { text }
  // (or /transcribe -> { id, transcription, ... } when storing on an account)
  local: {
    // Same-origin path proxied by the Vite dev/preview server to the local service
    // (see vite.config.js). Works from a phone, where "localhost" would be the phone.
    defaultUrl: "/whisper",
    defaultModel: "base",
    buildRequest({ baseUrl, model, apiKey, path = "/transcribe-text-only" }, formData) {
      return {
        url: `${baseUrl}${path}?model=${encodeURIComponent(model)}`,
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

// Effective transcription config: Settings UI overrides > .env > provider defaults.
// Read on every call, so saving settings takes effect immediately.
export function resolveConfig(settings = getSettings().transcription) {
  const name = settings.provider || "local";
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown transcription provider "${name}". Use: ${Object.keys(providers).join(", ")}`
    );
  }
  return {
    provider: name,
    baseUrl: (settings.url || provider.defaultUrl).replace(/\/+$/, ""),
    model: settings.model || provider.defaultModel,
    apiKey: settings.apiKey || "",
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

// Returns { text, remoteId }. With a user token (local provider only) the API stores the
// transcript on the account and `remoteId` is its id; otherwise remoteId is null.
export async function transcribeAudio(audioBlob, { token } = {}) {
  const config = resolveConfig();
  const { baseUrl } = config;
  const store = !!token && config.provider === "local";

  const formData = new FormData();
  formData.append("file", audioBlob, `audio.${getExtension(audioBlob)}`);

  // /transcribe (unlike /transcribe-text-only) returns the stored transcript's id
  const { url, init } = providers[config.provider].buildRequest(
    store ? { ...config, apiKey: token, path: "/transcribe" } : config,
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
    throw Object.assign(new Error(`${response.status} ${detail}`), {
      status: response.status,
    });
  }

  const result = await response.json();
  const text = result.text ?? result.transcription;
  return {
    text: typeof text === "string" ? text.trim() : "",
    remoteId: store && result.id != null ? result.id : null,
  };
}

export async function translateAudio(audioBlob) {
  return (await transcribeAudio(audioBlob)).text;
}
