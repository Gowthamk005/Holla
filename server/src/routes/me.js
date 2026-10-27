import { Router } from "express";
import { Video } from "../models/Video.js";
import { Interaction } from "../models/Interaction.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { OWNER_SELECT, pubUser, selfUser, videoOut } from "../utils/serialize.js";

const router = Router();
router.use(requireAuth);

/* GET /api/me/subscriptions -> { channels, videos } */
router.get("/subscriptions", async (req, res) => {
  const subs = await Subscription.find({ subscriber: req.user._id }).populate("channel", OWNER_SELECT);
  const channels = subs.map((s) => s.channel).filter(Boolean);
  const videos = await Video.find({ owner: { $in: channels.map((c) => c._id) } })
    .sort({ createdAt: -1 })
    .limit(40)
    .populate("owner", OWNER_SELECT);
  res.json({ channels: channels.map(pubUser), videos: videos.filter((v) => v.owner).map(videoOut) });
});

/* GET /api/me/library?type=like|save -> { videos } */
router.get("/library", async (req, res) => {
  const type = req.query.type === "save" ? "save" : "like";
  const items = await Interaction.find({ user: req.user._id, type })
    .sort({ createdAt: -1 })
    .limit(100)
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

export default router;
