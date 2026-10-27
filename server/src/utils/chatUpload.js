import multer from "multer";

/* holds the file in memory so it can be checked before it is saved */
export const uploadChat = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
}).single("file");
