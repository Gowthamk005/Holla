import path from "path";

/* Max size per kind, in MB */
export const LIMITS = { image: 16, video: 100, audio: 25, file: 25 };

export const MIME_BY_EXT = {
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};

/* Keeps only a safe file name (no folders, no control characters) */
export function sanitizeName(name) {
  const base = path.basename(String(name || "file")).replace(/[\x00-\x1f\\/]/g, "_").slice(0, 120);
  return base || "file";
}

/*
 * Decides what a file really is by reading its first bytes ("magic numbers").
 * The file name extension is NOT trusted, so a renamed .exe is rejected.
 * Returns { type, mime, ext } or null when the file is not allowed.
 */
export function detectFile(buf, originalName) {
  const b = buf;
  const ext = path.extname(String(originalName || "")).toLowerCase().slice(1);
  const at = (text, offset = 0) => b.length >= offset + text.length && b.toString("latin1", offset, offset + text.length) === text;
  const sig = (bytes) => b.length >= bytes.length && bytes.every((v, i) => b[i] === v);

  if (sig([0xff, 0xd8, 0xff])) return { type: "image", mime: "image/jpeg", ext: "jpg" };
  if (sig([0x89, 0x50, 0x4e, 0x47])) return { type: "image", mime: "image/png", ext: "png" };
  if (at("GIF8")) return { type: "image", mime: "image/gif", ext: "gif" };
  if (at("RIFF") && at("WEBP", 8)) return { type: "image", mime: "image/webp", ext: "webp" };
  if (at("RIFF") && at("WAVE", 8)) return { type: "audio", mime: "audio/wav", ext: "wav" };
  if (at("ftyp", 4)) {
    if (at("M4A ", 8)) return { type: "audio", mime: "audio/mp4", ext: "m4a" };
    if (at("qt  ", 8)) return { type: "video", mime: "video/quicktime", ext: "mov" };
    return { type: "video", mime: "video/mp4", ext: "mp4" };
  }
  if (sig([0x1a, 0x45, 0xdf, 0xa3])) return { type: "video", mime: "video/webm", ext: "webm" };
  if (at("ID3") || (b.length > 1 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { type: "audio", mime: "audio/mpeg", ext: "mp3" };
  if (at("OggS")) return { type: "audio", mime: "audio/ogg", ext: "ogg" };
  if (at("%PDF")) return { type: "file", mime: "application/pdf", ext: "pdf" };
  if (sig([0x50, 0x4b, 0x03, 0x04]) && ["docx", "xlsx", "pptx", "zip"].includes(ext)) {
    return { type: "file", mime: MIME_BY_EXT[ext], ext };
  }
  if (sig([0xd0, 0xcf, 0x11, 0xe0]) && ["doc", "xls", "ppt"].includes(ext)) {
    return { type: "file", mime: MIME_BY_EXT[ext], ext };
  }
  if (ext === "txt" && !b.includes(0)) return { type: "file", mime: "text/plain", ext: "txt" };
  return null;
}
