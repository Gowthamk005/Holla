import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Video } from "../models/Video.js";
import { Interaction } from "../models/Interaction.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { Activity } from "../models/Activity.js";
import { WatchHistory } from "../models/History.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { uploadAvatar } from "../utils/avatarUpload.js";
import { detectFile } from "../utils/filetype.js";
import { removeUpload } from "../utils/media.js";
import { OWNER_SELECT, pubUser, selfUser, videoOut } from "../utils/serialize.js";

const router = Router();
router.use(requireAuth);

const validDay = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const todayUtc = () => new Date().toISOString().slice(0, 10);
const clamp = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));

/* GET /api/me/subscriptions -> { channels, videos } */
router.get("/subscriptions", async (req, res) => {
  const subs = await Subscription.find({ subscriber: req.user._id }).populate("channel", OWNER_SELECT);
  const channels = subs.map((s) => s.channel).filter(Boolean);
  const videos = await Video.find({ owner: { $in: channels.map((c) => c._id) } })
    .sort({ createdAt: -1 }).limit(40).populate("owner", OWNER_SELECT);
  res.json({ channels: channels.map(pubUser), videos: videos.filter((v) => v.owner).map(videoOut) });
});

/* GET /api/me/library?type=like|save -> { videos } */
router.get("/library", async (req, res) => {
  const type = req.query.type === "save" ? "save" : "like";
  const items = await Interaction.find({ user: req.user._id, type }).sort({ createdAt: -1 }).limit(100)
    .populate({ path: "video", populate: { path: "owner", select: OWNER_SELECT } });
  res.json({ videos: items.map((i) => i.video).filter((v) => v && v.owner).map(videoOut) });
});

/* GET /api/me/videos -> { videos, stats } */
router.get("/videos", async (req, res) => {
  const [list, totals] = await Promise.all([
    Video.find({ owner: req.user._id }).sort({ createdAt: -1 }).populate("owner", OWNER_SELECT),
    Video.aggregate([
      { $match: { owner: req.user._id } },
      { $group: { _id: null, views: { $sum: "$views" }, bytes: { $sum: "$size" } } },
    ]),
  ]);
  const t = totals[0] || { views: 0, bytes: 0 };
  res.json({
    videos: list.filter((v) => v.owner).map(videoOut),
    stats: { videos: list.length, views: t.views, bytes: t.bytes },
  });
});

/* GET /api/me/history -> { items: [{ video, position, updatedAt }] } */
router.get("/history", async (req, res) => {
  const items = await WatchHistory.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(100)
    .populate({ path: "video", populate: { path: "owner", select: OWNER_SELECT } });
  res.json({
    items: items.filter((i) => i.video && i.video.owner)
      .map((i) => ({ video: videoOut(i.video), position: i.position, updatedAt: i.updatedAt })),
  });
});

/* POST /api/me/activity  { app: seconds, watch: seconds, day: "YYYY-MM-DD" (your local day) } */
router.post("/activity", async (req, res) => {
  const app = clamp(req.body?.app, 60);
  const watch = clamp(req.body?.watch, 60);
  const day = validDay(req.body?.day) || todayUtc();
  if (app || watch) {
    await Activity.updateOne({ user: req.user._id, day }, { $inc: { app, watch } }, { upsert: true });
  }
  res.json({ ok: true });
});

/* GET /api/me/stats?day=YYYY-MM-DD -> today, all-time totals, and the last 7 days */
router.get("/stats", async (req, res) => {
  const base = validDay(req.query.day) || todayUtc();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const rows = await Activity.find({ user: req.user._id, day: { $in: days } }).lean();
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = days.map((d) => ({ day: d, app: byDay.get(d)?.app || 0, watch: byDay.get(d)?.watch || 0 }));
  const [all] = await Activity.aggregate([
    { $match: { user: req.user._id } },
    { $group: { _id: null, app: { $sum: "$app" }, watch: { $sum: "$watch" } } },
  ]);
  const today = series[series.length - 1];
  res.json({
    today: { app: today.app, watch: today.watch },
    total: { app: all?.app || 0, watch: all?.watch || 0 },
    days: series,
  });
});

/* PATCH /api/me  { name, bio } -> { user } */
router.patch("/", async (req, res) => {
  const update = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name || name.length > 40) fail(400, "Display name must be 1 to 40 characters.");
    update.name = name;
  }
  if (req.body?.bio !== undefined) update.bio = String(req.body.bio).slice(0, 300);
  if (!Object.keys(update).length) fail(400, "Nothing to update.");
  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  res.json({ user: selfUser(user) });
});

/* POST /api/me/avatar  (multipart: avatar) -> { user } */
router.post("/avatar", (req, res, next) => uploadAvatar(req, res, (err) => (err ? next(err) : next())), async (req, res) => {
  const file = req.file;
  if (!file) fail(400, "Choose a picture.");
  const kind = detectFile(file.buffer, file.originalname);
  if (!kind || kind.type !== "image") fail(400, "Profile picture must be a JPG, PNG, WebP or GIF image.");

  const dir = path.join(config.uploadsDir, "avatars");
  await fs.mkdir(dir, { recursive: true });
  const name = crypto.randomBytes(10).toString("hex") + "." + kind.ext;
  await fs.writeFile(path.join(dir, name), file.buffer);

  await removeUpload(req.user.avatarUrl);
  const user = await User.findByIdAndUpdate(req.user._id, { avatarUrl: `/uploads/avatars/${name}` }, { new: true });
  res.json({ user: selfUser(user) });
});

export default router;