import { Router } from "express";
import { Video } from "../models/Video.js";
import { Interaction } from "../models/Interaction.js";
import { Subscription } from "../models/Subscription.js";
import { CATEGORIES } from "../config.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { uploadFields, deleteVideoFiles } from "../utils/media.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { OWNER_SELECT, videoOut } from "../utils/serialize.js";
import { makeRenditions } from "../utils/transcode.js";

const router = Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* GET /api/videos?sort=latest|views&category=&q=&limit= */
router.get("/", async (req, res) => {
  const { sort = "latest", category, q, limit = 24 } = req.query;
  const filter = {};
  if (category) {
    if (!CATEGORIES.includes(category)) fail(400, "Unknown category.");
    filter.category = category;
  }
  if (q) filter.title = { $regex: escapeRegex(String(q).slice(0, 100)), $options: "i" };

  const order = sort === "views" ? { views: -1, createdAt: -1 } : { createdAt: -1 };
  const max = Math.min(50, Math.max(1, parseInt(limit, 10) || 24));

  const list = await Video.find(filter).sort(order).limit(max).populate("owner", OWNER_SELECT);
  res.json({ videos: list.filter((v) => v.owner).map(videoOut) });
});

/* POST /api/videos  (multipart: video, optional thumb, title, description, category, duration) */
router.post(
  "/",
  requireAuth,
  (req, res, next) => uploadFields(req, res, (err) => (err ? next(err) : next())),
  async (req, res) => {
    const video = req.files?.video?.[0];
    const thumb = req.files?.thumb?.[0];
    const videoUrl = video && `/uploads/videos/${video.filename}`;
    const thumbUrl = thumb && `/uploads/thumbs/${thumb.filename}`;

    try {
      if (!video) fail(400, "Choose a video file.");
      const title = String(req.body.title || "").trim();
      if (!title || title.length > 100) fail(400, "Title is required (max 100 characters).");
      const category = String(req.body.category || "");
      if (!CATEGORIES.includes(category)) fail(400, "Pick a valid category.");

      const doc = await Video.create({
        owner: req.user._id,
        title,
        description: String(req.body.description || "").slice(0, 500),
        category,
        videoUrl,
        videoFile: video.filename,
        thumbnailUrl: thumbUrl || "",
        thumbFile: thumb ? thumb.filename : "",
        duration: Math.min(6 * 3600, Math.max(0, parseFloat(req.body.duration) || 0)),
        size: video.size,
      });
      await doc.populate("owner", OWNER_SELECT);
      makeRenditions(doc._id).catch(() => {}); // runs in the background, does not slow the upload
      res.status(201).json({ video: videoOut(doc) });
    } catch (err) {
      // do not keep files for a failed upload
      await deleteVideoFiles({ videoUrl, thumbnailUrl: thumbUrl }).catch(() => {});
      throw err;
    }
  }
);

/* GET /api/videos/:id  -> { video, viewer } */
router.get("/:id", optionalAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const v = await Video.findById(req.params.id).populate("owner", OWNER_SELECT);
  if (!v || !v.owner) fail(404, "Video not found.");

  const viewer = { liked: false, saved: false, subscribed: false };
  if (req.user) {
    const [inter, sub] = await Promise.all([
      Interaction.find({ user: req.user._id, video: v._id }).select("type"),
      Subscription.exists({ subscriber: req.user._id, channel: v.owner._id }),
    ]);
    viewer.liked = inter.some((i) => i.type === "like");
    viewer.saved = inter.some((i) => i.type === "save");
    viewer.subscribed = !!sub;
  }
  res.json({ video: videoOut(v), viewer });
});

/* POST /api/videos/:id/view  -> counts one view */
router.post("/:id/view", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  await Video.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
  res.json({ ok: true });
});

/* POST /api/videos/:id/interact  { type: "like"|"save", on: true|false } */
router.post("/:id/interact", requireAuth, async (req, res) => {
  const { type, on } = req.body || {};
  if (!["like", "save"].includes(type)) fail(400, "Unknown action.");
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const videoId = req.params.id;
  if (!(await Video.exists({ _id: videoId }))) fail(404, "Video not found.");

  if (on) {
    const r = await Interaction.updateOne(
      { user: req.user._id, video: videoId, type },
      { $set: { type } },
      { upsert: true }
    );
    if (type === "like" && r.upsertedCount) await Video.updateOne({ _id: videoId }, { $inc: { likesCount: 1 } });
  } else {
    const r = await Interaction.deleteOne({ user: req.user._id, video: videoId, type });
    if (type === "like" && r.deletedCount) await Video.updateOne({ _id: videoId }, { $inc: { likesCount: -1 } });
  }

  const v = await Video.findById(videoId).select("likesCount");
  res.json({ likesCount: v.likesCount, [type === "like" ? "liked" : "saved"]: !!on });
});

/* DELETE /api/videos/:id  (owner or admin) */
router.delete("/:id", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const v = await Video.findById(req.params.id);
  if (!v) fail(404, "Video not found.");
  const isOwner = String(v.owner) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") fail(403, "You can only delete your own videos.");

  await deleteVideoFiles(v);
  await Promise.all([Video.deleteOne({ _id: v._id }), Interaction.deleteMany({ video: v._id })]);
  res.json({ ok: true });
});

export default router;
