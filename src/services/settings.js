// Runtime settings = .env defaults, overridden by values saved from the Settings UI.
// Overrides live in localStorage (this browser only, stored in plain text) and only
// contain fields the user explicitly set; an empty field always means "use the default".

const STORAGE_KEY = "audioTranslator.settings";

export const FIELDS = {
  transcription: ["provider", "url", "model", "apiKey"],
  translate: ["url", "apiKey", "targetLanguage"],
  agent: ["url", "apiKey"],
};

export const DEFAULT_TARGET_LANGUAGE = "English";

export function getEnvDefaults(env = import.meta.env) {
  return {
    transcription: {
      provider: env.VITE_TRANSCRIPTION_PROVIDER || "",
      url: env.VITE_TRANSCRIPTION_API_URL || "",
      model: env.VITE_WHISPER_MODEL || "",
      apiKey: env.VITE_TRANSCRIPTION_API_KEY || "",
    },
    translate: {
      url: env.VITE_TRANSLATE_API_URL || "",
      apiKey: env.VITE_TRANSLATE_API_KEY || "",
      targetLanguage:
        env.VITE_TRANSLATE_TARGET_LANGUAGE || DEFAULT_TARGET_LANGUAGE,
    },
    agent: {
      url: env.VITE_AGENT_API_URL || "",
      apiKey: env.VITE_AGENT_API_KEY || "",
    },
  };
}

// Same shape as FIELDS with every value ""
export function blankSettings() {
  return Object.fromEntries(
    Object.entries(FIELDS).map(([section, fields]) => [
      section,
      Object.fromEntries(fields.map((f) => [f, ""])),
    ])
  );
}

// Keep only known sections/fields with non-empty trimmed string values
function sanitize(input) {
  const out = blankSettings();
  for (const [section, fields] of Object.entries(FIELDS)) {
    for (const field of fields) {
      const value = input?.[section]?.[field];
      if (typeof value === "string") out[section][field] = value.trim();
    }
  }
  return out;
}

export function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    return blankSettings();
  }
}

export function saveOverrides(overrides) {
  const clean = sanitize(overrides);
  const hasAny = Object.values(clean).some((section) =>
    Object.values(section).some(Boolean)
  );
  try {
    if (hasAny) localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new Error("Could not save settings (browser storage unavailable)");
  }
}

export function clearOverrides() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

// Effective settings: override if set, otherwise the env default
export function getSettings(env = import.meta.env) {
  const defaults = getEnvDefaults(env);
  const overrides = loadOverrides();
  const merged = blankSettings();
  for (const [section, fields] of Object.entries(FIELDS)) {
    for (const field of fields) {
      merged[section][field] =
        overrides[section][field] || defaults[section][field];
    }
  }
  return merged;
}
