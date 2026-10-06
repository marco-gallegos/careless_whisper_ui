// Client for the careless_whisper account API: /auth/* and /transcripts.
// It lives on the same base URL as the local transcription provider (default /whisper,
// proxied by Vite), so accounts only exist when that provider is selected.

import { resolveConfig } from "./translationService";

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function accountsAvailable() {
  try {
    return resolveConfig().provider === "local";
  } catch {
    return false;
  }
}

function baseUrl() {
  const config = resolveConfig();
  if (config.provider !== "local") {
    throw new ApiError(
      "Accounts need the local transcription provider (see Settings)"
    );
  }
  return config.baseUrl;
}

// FastAPI errors: { detail: "text" } or, for validation (422), { detail: [{ msg }] }
function errorDetail(body, fallback) {
  const d = body?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).filter(Boolean).join(", ") || fallback;
  return fallback;
}

// Identical GETs that are already in flight share one request (React StrictMode mounts
// effects twice in dev, and several callers can ask for the same list at once).
const inflight = new Map();

function request(path, options = {}) {
  if ((options.method || "GET") !== "GET") return send(path, options);
  const key = `${options.token || ""} ${path}`;
  if (!inflight.has(key)) {
    inflight.set(
      key,
      send(path, options).finally(() => inflight.delete(key))
    );
  }
  return inflight.get(key);
}

async function send(path, { method = "GET", token, json, form } = {}) {
  const base = baseUrl();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let body;
  if (json) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  } else if (form) {
    body = new URLSearchParams(form); // sets the form content type itself
  }

  let response;
  try {
    response = await fetch(`${base}${path}`, { method, headers, body });
  } catch {
    throw new ApiError(`Cannot reach the API at ${base}`);
  }

  if (!response.ok) {
    let parsed = null;
    try {
      parsed = await response.json();
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      errorDetail(parsed, response.statusText || "Request failed"),
      response.status
    );
  }
  return response.status === 204 ? null : response.json();
}

// --- Auth -------------------------------------------------------------------

export const register = (username, password) =>
  request("/auth/register", { method: "POST", json: { username, password } });

// /auth/login is an OAuth2 password form, not JSON
export const login = (username, password) =>
  request("/auth/login", { method: "POST", form: { username, password } });

export const me = (token) => request("/auth/me", { token });

// --- Transcripts ------------------------------------------------------------

const PAGE = 200; // server maximum

export const createTranscript = (token, data) =>
  request("/transcripts", { method: "POST", token, json: data });

export const updateTranscript = (token, id, data) =>
  request(`/transcripts/${id}`, { method: "PATCH", token, json: data });

export const deleteTranscript = (token, id) =>
  request(`/transcripts/${id}`, { method: "DELETE", token });

export async function listTranscripts(token) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await request(`/transcripts?offset=${offset}&limit=${PAGE}`, {
      token,
    });
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

// The server stores naive UTC datetimes; without a zone designator the browser would
// read them as local time.
function toIso(value) {
  return /(Z|[+-]\d\d:?\d\d)$/.test(value) ? value : `${value}Z`;
}

// Shape a server transcript like a local record. `id` is namespaced because local ids
// (Date.now()) and server ids (1, 2, ...) are different spaces.
export function toRecord(t) {
  return {
    id: `api:${t.id}`,
    remoteId: t.id,
    source: "api",
    text: t.text,
    language: t.language,
    filename: t.filename,
    status: "done",
    timestamp: toIso(t.created_at),
    duration: 0,
  };
}
