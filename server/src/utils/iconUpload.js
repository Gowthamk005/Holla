import multer from "multer";

/* app icons: one image, max 2 MB, checked by content before saving */
export const uploadIcon = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
}).single("icon");
