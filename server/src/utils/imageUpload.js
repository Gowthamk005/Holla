import multer from "multer";

/* profile picture or banner: one image, max 8 MB (checked by content in the route) */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
}).single("image");
