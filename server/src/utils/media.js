import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { config } from "../config.js";

const VIDEO_EXT = [".mp4", ".webm", ".mov", ".ogg", ".mkv"];
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(config.uploadsDir, file.fieldname === "thumb" ? "thumbs" : "videos")),
  filename: (req, file, cb) =>
    cb(null, crypto.randomBytes(12).toString("hex") + path.extname(file.originalname).toLowerCase()),
});

/* accepts one "video" file and an optional "thumb" image */
export const uploadFields = multer({
  storage,
  limits: { fileSize: config.maxVideoBytes, files: 2 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const isThumb = file.fieldname === "thumb";
    const ok = isThumb
      ? IMAGE_EXT.includes(ext) && file.mimetype.startsWith("image/")
      : VIDEO_EXT.includes(ext) && file.mimetype.startsWith("video/");
    if (!ok) {
      const err = new Error(isThumb ? "Thumbnail must be an image (jpg, png or webp)." : "Video must be mp4, webm, mov, ogg or mkv.");
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "thumb", maxCount: 1 },
]);

/* Deletes a file only if it is inside our uploads folder */
export async function removeUpload(url) {
  if (!url || !url.startsWith("/uploads/")) return;
  const full = path.resolve(config.uploadsDir, url.replace(/^\/uploads\//, ""));
  if (!full.startsWith(config.uploadsDir + path.sep)) return;
  await fs.unlink(full).catch(() => {});
}

export async function deleteVideoFiles(video) {
  await Promise.all([
    removeUpload(video.videoUrl),
    removeUpload(video.thumbnailUrl),
    ...(video.renditions || []).map((r) => removeUpload(r.url)),
  ]);
}
