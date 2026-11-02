import { Router } from "express";
import path from "path";
import { Video } from "../models/Video.js";
import { Interaction } from "../models/Interaction.js";
import { Subscription } from "../models/Subscription.js";
import { ViewLog } from "../models/ViewLog.js";
import { WatchHistory } from "../models/History.js";
import { Comment } from "../models/Comment.js";
import { CATEGORIES, config } from "../config.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { uploadFields, deleteVideoFiles } from "../utils/media.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { OWNER_SELECT, videoOut } from "../utils/serialize.js";
import { processVideo } from "../utils/transcode.js";
import { probe } from "../utils/probe.js";
import { extractHashtags } from "../utils/hashtags.js";

const router = Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* GET /api/videos?sort=latest|views&category=&q=&tag=&limit=&format=video|short */
router.get("/", async (req, res) => {
  const { sort = "latest", category, q, tag, limit = 24, format } = req.query;
  const filter = {};
  if (category) {
    if (!CATEGORIES.includes(category)) fail(400, "Unknown category.");
    filter.category = category;
  }
  if (format === "short" || format === "video") filter.format = format;
  if (q) filter.title = { $regex: escapeRegex(String(q).slice(0, 100)), $options: "i" };
  if (tag) filter.hashtags = String(tag).replace(/^#/, "").toLowerCase().slice(0, 50);

  const order = sort === "views" ? { views: -1, createdAt: -1 } : { createdAt: -1 };
  const max = Math.min(50, Math.max(1, parseInt(limit, 10) || 24));
  const list = await Video.find(filter).sort(order).limit(max).populate("owner", OWNER_SELECT);
  res.json({ videos: list.filter((v) => v.owner).map(videoOut) });
});

/* POST /api/videos  (multipart: video, thumb (optional), title, description, category, format) */
router.post(
  "/",
  requireAuth,
  (req, res, next) => uploadFields(req, res, (err) => (err ? next(err) : next())),
  async (req, res) => {
    const video = req.files?.video?.[0];
    const thumb = req.files?.thumb?.[0];
    const videoUrl = video && `/uploads/videos/${video.filename}`;
    const thumbnailUrl = thumb && `/uploads/thumbs/${thumb.filename}`;

    try {
      if (!video) fail(400, "Choose a video file.");
      const title = String(req.body.title || "").trim();
      if (!title || title.length > 100) fail(400, "Title is required (max 100 characters).");
      const category = String(req.body.category || "");
      if (!CATEGORIES.includes(category)) fail(400, "Pick a valid category.");
      const format = req.body.format === "short" ? "short" : "video";
      const description = String(req.body.description || "").slice(0, 500);

      // shape check (needs FFmpeg; skipped if it is not installed)
      const info = await probe(path.join(config.uploadsDir, "videos", video.filename));
      if (info && info.width && info.height) {
        if (format === "short" && info.height < info.width * 1.2) {
          fail(400, "Shorts must be vertical (9:16). Choose Video for landscape clips.");
        }
        if (format === "video" && info.width < info.height * 1.2) {
          fail(400, "Videos must be landscape (16:9). Choose Short for vertical clips.");
        }
      }

      const doc = await Video.create({
        owner: req.user._id,
        title,
        description,
        category,
        format,
        hashtags: extractHashtags(`${title} ${description}`),
        videoUrl,
        videoFile: video.filename,
        thumbnailUrl: thumbnailUrl || "",
        thumbFile: thumb ? thumb.filename : "",
        duration: info?.duration
          ? Math.round(info.duration)
          : Math.min(6 * 3600, Math.max(0, parseFloat(req.body.duration) || 0)),
        size: video.size,
      });
      await doc.populate("owner", OWNER_SELECT);
      processVideo(doc._id).catch(() => {}); // automatic thumbnail + qualities in the background
      res.status(201).json({ video: videoOut(doc) });
    } catch (err) {
      await deleteVideoFiles({ videoUrl, thumbnailUrl }).catch(() => {});
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
      Interaction.find({ user: req.user._id, video: v._id }).select("type").lean(),
      Subscription.exists({ subscriber: req.user._id, channel: v.owner._id }),
    ]);
    viewer.liked = inter.some((i) => i.type === "like");
    viewer.saved = inter.some((i) => i.type === "save");
    viewer.subscribed = !!sub;
  }
  res.json({ video: videoOut(v), viewer });
});

/* PATCH /api/videos/:id  { title, description, category }  (owner or admin)
   Hashtags are re-read from the title and description every time. */
router.patch("/:id", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const v = await Video.findById(req.params.id).populate("owner", OWNER_SELECT);
  if (!v || !v.owner) fail(404, "Video not found.");

  const isOwner = String(v.owner._id) === String(req.user._id);
  if (!isOwner && req.user.role !== "admin") fail(403, "You can only edit your own videos.");

  const b = req.body || {};
  if (b.title !== undefined) {
    const title = String(b.title).trim();
    if (!title || title.length > 100) fail(400, "Title is required (max 100 characters).");
    v.title = title;
  }
  if (b.description !== undefined) v.description = String(b.description).slice(0, 500);
  if (b.category !== undefined) {
    if (!CATEGORIES.includes(b.category)) fail(400, "Pick a valid category.");
    v.category = b.category;
  }
  v.hashtags = extractHashtags(`${v.title} ${v.description || ""}`);
  await v.save();
  res.json({ video: videoOut(v) });
});

/* POST /api/videos/:id/view — counts once per viewer; the owner's own views are not counted */
router.post("/:id/view", optionalAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const v = await Video.findById(req.params.id).select("owner");
  if (!v) fail(404, "Video not found.");
  if (req.user && String(v.owner) === String(req.user._id)) return res.json({ counted: false });

  const viewer = req.user
    ? `u:${req.user._id}`
    : `a:${String(req.get("x-viewer") || req.ip || "anon").slice(0, 80)}`;
  try {
    await ViewLog.create({ video: v._id, viewer });
    await Video.updateOne({ _id: v._id }, { $inc: { views: 1 } });
    res.json({ counted: true });
  } catch (err) {
    if (err.code === 11000) return res.json({ counted: false });
    throw err;
  }
});

/* POST /api/videos/:id/progress  { position } — remembers where you stopped */
router.post("/:id/progress", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const position = Math.max(0, Math.min(86400, Number(req.body?.position) || 0));
  if (!(await Video.exists({ _id: req.params.id }))) fail(404, "Video not found.");
  await WatchHistory.updateOne(
    { user: req.user._id, video: req.params.id },
    { $set: { position } },
    { upsert: true }
  );
  res.json({ ok: true });
});

/* POST /api/videos/:id/interact  { type: "like"|"save", on } */
router.post("/:id/interact", requireAuth, async (req, res) => {
  const { type, on } = req.body || {};
  if (!["like", "save"].includes(type)) fail(400, "Unknown action.");
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const videoId = req.params.id;
  if (!(await Video.exists({ _id: videoId }))) fail(404, "Video not found.");

  if (on) {
    const r = await Interaction.updateOne({ user: req.user._id, video: videoId, type }, { $set: { type } }, { upsert: true });
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
  await Promise.all([
    Video.deleteOne({ _id: v._id }),
    Interaction.deleteMany({ video: v._id }),
    WatchHistory.deleteMany({ video: v._id }),
    ViewLog.deleteMany({ video: v._id }),
    Comment.deleteMany({ video: v._id }),
  ]);
  res.json({ ok: true });
});

export default router;
