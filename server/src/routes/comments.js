import { Router } from "express";
import { Comment } from "../models/Comment.js";
import { Video } from "../models/Video.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { mini } from "../utils/serialize.js";

const router = Router();

const clean = (t) => String(t || "").trim().slice(0, 500);
const out = (c, user) => ({
  id: String(c._id),
  text: c.text,
  createdAt: c.createdAt,
  editedAt: c.editedAt || null,
  user: mini(user),
});

/* GET /api/comments/video/:videoId?limit=20&before=ISO -> { comments, total, hasMore } (newest first) */
router.get("/video/:videoId", optionalAuth, async (req, res) => {
  if (!isId(req.params.videoId)) fail(404, "Video not found.");
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

  const q = { video: req.params.videoId };
  if (req.query.before) {
    const d = new Date(String(req.query.before));
    if (!isNaN(d)) q.createdAt = { $lt: d };
  }

  const list = await Comment.find(q)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("user", "username name avatarUrl");
  const total = await Comment.countDocuments({ video: req.params.videoId });

  res.json({
    comments: list.slice(0, limit).filter((c) => c.user).map((c) => out(c, c.user)),
    total,
    hasMore: list.length > limit,
  });
});

/* POST /api/comments/video/:videoId  { text } */
router.post("/video/:videoId", requireAuth, async (req, res) => {
  if (!isId(req.params.videoId)) fail(404, "Video not found.");
  const text = clean(req.body?.text);
  if (!text) fail(400, "Write something first.");
  if (!(await Video.exists({ _id: req.params.videoId }))) fail(404, "Video not found.");

  const c = await Comment.create({ video: req.params.videoId, user: req.user._id, text });
  await Video.updateOne({ _id: req.params.videoId }, { $inc: { commentsCount: 1 } });
  res.status(201).json({ comment: out(c, req.user) });
});

/* PATCH /api/comments/:id  { text }  (author only) */
router.patch("/:id", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Comment not found.");
  const c = await Comment.findById(req.params.id);
  if (!c) fail(404, "Comment not found.");
  if (String(c.user) !== String(req.user._id)) fail(403, "You can only edit your own comments.");

  const text = clean(req.body?.text);
  if (!text) fail(400, "Comment cannot be empty.");
  c.text = text;
  c.editedAt = new Date();
  await c.save();
  res.json({ comment: out(c, req.user) });
});

/* DELETE /api/comments/:id  (author, video owner, or admin) */
router.delete("/:id", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Comment not found.");
  const c = await Comment.findById(req.params.id);
  if (!c) fail(404, "Comment not found.");

  const video = await Video.findById(c.video).select("owner");
  const allowed =
    String(c.user) === String(req.user._id) ||
    (video && String(video.owner) === String(req.user._id)) ||
    req.user.role === "admin";
  if (!allowed) fail(403, "You cannot delete this comment.");

  await Comment.deleteOne({ _id: c._id });
  await Video.updateOne({ _id: c.video }, { $inc: { commentsCount: -1 } });
  res.json({ ok: true });
});

export default router;