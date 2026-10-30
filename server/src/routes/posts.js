import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { detectFile } from "../utils/filetype.js";
import { removeUpload } from "../utils/media.js";
import { mini } from "../utils/serialize.js";

const router = Router();

const uploadImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
}).array("images", 10);

const postOut = (p, owner) => ({
  id: String(p._id),
  caption: p.caption || "",
  images: p.images.map((i) => ({ url: i.url, kind: i.kind })),
  createdAt: p.createdAt,
  owner: mini(owner),
});

/* POST /api/posts  (multipart: images[] up to 10, caption) — photos and GIFs only */
router.post("/", requireAuth, (req, res, next) => uploadImages(req, res, (err) => (err ? next(err) : next())), async (req, res) => {
  const files = req.files || [];
  if (!files.length) fail(400, "Choose at least one photo or GIF.");
  const caption = String(req.body?.caption || "").trim().slice(0, 500);

  const dir = path.join(config.uploadsDir, "posts");
  await fs.mkdir(dir, { recursive: true });
  const saved = [];
  try {
    for (const f of files) {
      const kind = detectFile(f.buffer, f.originalname);
      if (!kind || kind.type !== "image") fail(400, "Only photos (JPG, PNG, WebP) and GIFs can be posted.");
      const name = crypto.randomBytes(10).toString("hex") + "." + kind.ext;
      await fs.writeFile(path.join(dir, name), f.buffer);
      saved.push({ url: `/uploads/posts/${name}`, kind: kind.ext === "gif" ? "gif" : "image", mime: kind.mime });
    }
    const post = await Post.create({ owner: req.user._id, caption, images: saved });
    res.status(201).json({ post: postOut(post, req.user) });
  } catch (err) {
    for (const s of saved) await removeUpload(s.url);
    throw err;
  }
});

/* GET /api/posts/by/:username -> { posts } */
router.get("/by/:username", async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user) fail(404, "User not found.");
  const posts = await Post.find({ owner: user._id }).sort({ createdAt: -1 }).limit(60);
  res.json({ posts: posts.map((p) => postOut(p, user)) });
});

/* DELETE /api/posts/:id  (owner only) */
router.delete("/:id", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Post not found.");
  const p = await Post.findById(req.params.id);
  if (!p) fail(404, "Post not found.");
  if (String(p.owner) !== String(req.user._id)) fail(403, "You can only delete your own posts.");
  for (const i of p.images) await removeUpload(i.url);
  await Post.deleteOne({ _id: p._id });
  res.json({ ok: true });
});

export default router;