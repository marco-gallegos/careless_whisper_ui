// Audio utility functions

export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function getAudioDuration(audioBlob) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      resolve(audio.duration);
    });
    audio.addEventListener("error", () => {
      resolve(0);
    });
    audio.src = URL.createObjectURL(audioBlob);
  });
}

/**
 * Convert Blob to base64 string with data URL prefix
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Base64 string with data URL prefix (e.g., "data:audio/webm;base64,...")
 */
export function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Blob to base64 string without data URL prefix
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Pure base64 string without prefix
 */
export function blobToBase64Pure(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:audio/webm;base64,")
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Blob to base64 using ArrayBuffer approach
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} Pure base64 string
 */
export async function blobToBase64Buffer(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}

/**
 * Convert base64 string back to Blob
 * @param {string} base64 - Base64 string (with or without data URL prefix)
 * @param {string} mimeType - MIME type for the blob (e.g., 'audio/webm')
 * @returns {Blob} The reconstructed blob
 */
export function base64ToBlob(base64, mimeType = "audio/webm") {
  // Remove data URL prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

  // Convert base64 to binary
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

/**
 * Get base64 data URL from audio blob for use in APIs
 * @param {Blob} audioBlob - Audio blob to convert
 * @returns {Promise<Object>} Object with base64 string and metadata
 */
export async function getBase64ForAPI(audioBlob) {
  const base64WithPrefix = await convertBlobToBase64(audioBlob);
  const base64Pure = base64WithPrefix.split(",")[1];

  return {
    base64: base64Pure,
    dataUrl: base64WithPrefix,
    mimeType: audioBlob.type,
    size: audioBlob.size,
    sizeFormatted: formatFileSize(audioBlob.size),
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Audio format detection
export function getAudioMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/wav",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "audio/webm"; // fallback
}
