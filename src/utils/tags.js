// Helpers for favorites' tags: naming rules, palette and readable text colors.

export const TAG_COLORS = [
  "#0d6efd",
  "#6f42c1",
  "#d63384",
  "#dc3545",
  "#fd7e14",
  "#198754",
  "#20c997",
  "#6c757d",
];

export const MAX_TAG_LENGTH = 30;

export function normalizeTagName(name = "") {
  return name.trim().replace(/\s+/g, " ");
}

// Returns an error message, or null when the name is acceptable.
// `ignoreName` is the tag being renamed (so it doesn't clash with itself).
export function validateTagName(name, tags, ignoreName = null) {
  const normalized = normalizeTagName(name);
  if (!normalized) return "Tag name is required";
  if (normalized.length > MAX_TAG_LENGTH) {
    return `Tag name must be ${MAX_TAG_LENGTH} characters or fewer`;
  }
  const clash = tags.some(
    (t) =>
      t.name !== ignoreName && t.name.toLowerCase() === normalized.toLowerCase()
  );
  return clash ? "A tag with that name already exists" : null;
}

// Black or white, whichever reads better on the given #rrggbb background
export function textColorFor(hex = "#6c757d") {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}

export function nextTagColor(tags) {
  return TAG_COLORS[tags.length % TAG_COLORS.length];
}
