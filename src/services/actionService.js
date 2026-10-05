// Calls to the two configurable external endpoints: translate and agent instruction.
//
// Contract (both): POST <url> with JSON, optional `Authorization: Bearer <apiKey>`.
//   translate -> { action: "translate", text, target_language, id, timestamp }
//   agent     -> { action: "agent_instruction", text, id, timestamp }
// Response: plain text, a JSON string, or a JSON object with the result as a string in
// one of RESPONSE_KEYS (first match wins).

import { getSettings } from "./settings";

const RESPONSE_KEYS = [
  "text",
  "translation",
  "translatedText",
  "result",
  "output",
  "response",
  "answer",
  "message",
  "content",
];

function extractText(body) {
  if (typeof body === "string") return body.trim();
  if (body && typeof body === "object") {
    for (const key of RESPONSE_KEYS) {
      if (typeof body[key] === "string") return body[key].trim();
    }
  }
  return null;
}

function extractDetail(body, raw, statusText) {
  const detail = body?.detail ?? body?.error?.message ?? body?.error ?? null;
  if (detail) return typeof detail === "string" ? detail : JSON.stringify(detail);
  return raw ? raw.slice(0, 200) : statusText;
}

async function postJson(label, { url, apiKey }, payload) {
  if (!url) {
    throw new Error(
      `${label} endpoint is not configured. Set it in Menu → Settings (or in .env).`
    );
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Cannot reach the ${label.toLowerCase()} endpoint at ${url}`);
  }

  const raw = await response.text();
  let body = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // plain-text response, keep raw
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${extractDetail(body, raw, response.statusText)}`);
  }

  const text = extractText(body);
  if (text === null) {
    throw new Error(
      `${label} endpoint returned no text (expected plain text or a string in: ${RESPONSE_KEYS.join(", ")})`
    );
  }
  return text;
}

// Returns { text, language }
export async function translateText(text, { id, timestamp } = {}) {
  const { translate } = getSettings();
  const language = translate.targetLanguage;
  const result = await postJson("Translation", translate, {
    action: "translate",
    text,
    target_language: language,
    id,
    timestamp,
  });
  return { text: result, language };
}

// Returns the agent's reply text
export async function sendToAgent(text, { id, timestamp } = {}) {
  const { agent } = getSettings();
  return postJson("Agent", agent, {
    action: "agent_instruction",
    text,
    id,
    timestamp,
  });
}
