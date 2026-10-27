import { Router } from "express";
import { User } from "../models/User.js";
import { Video } from "../models/Video.js";
import { Subscription } from "../models/Subscription.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { pubUser, videoOut } from "../utils/serialize.js";
import { friendStatus } from "../utils/social.js";

const router = Router();

/* GET /api/channels/:username -> { channel, videos, viewer } */
router.get("/:username", optionalAuth, async (req, res) => {
  const user = await User.findOne({ username: String(req.params.username).toLowerCase() });
  if (!user || user.disabled) fail(404, "Channel not found.");

  const videos = await Video.find({ owner: user._id })
    .sort({ createdAt: -1 })
    .limit(60)
    .populate("owner", "username name avatarUrl bannerUrl bio subscribersCount createdAt");

  const viewer = { subscribed: false, friendStatus: "none" };
  if (req.user && String(req.user._id) !== String(user._id)) {
    viewer.subscribed = !!(await Subscription.exists({ subscriber: req.user._id, channel: user._id }));
    viewer.friendStatus = await friendStatus(req.user._id, user._id);
  }

  res.json({
    channel: { ...pubUser(user), createdAt: user.createdAt },
    videos: videos.filter((v) => v.owner).map(videoOut),
    viewer,
  });
});

/* POST /api/channels/:id/subscribe  { on } -> { subscribed, subscribersCount } */
router.post("/:id/subscribe", requireAuth, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Channel not found.");
  const channelId = req.params.id;
  if (String(req.user._id) === channelId) fail(400, "You cannot subscribe to your own channel.");
  const channel = await User.findById(channelId).select("_id");
  if (!channel) fail(404, "Channel not found.");

  const on = !!req.body?.on;
  if (on) {
    try {
      await Subscription.create({ subscriber: req.user._id, channel: channelId });
      await User.updateOne({ _id: channelId }, { $inc: { subscribersCount: 1 } });
    } catch (err) {
      if (err.code !== 11000) throw err; // already subscribed: nothing to do
    }
  } else {
    const r = await Subscription.deleteOne({ subscriber: req.user._id, channel: channelId });
    if (r.deletedCount) await User.updateOne({ _id: channelId }, { $inc: { subscribersCount: -1 } });
  }

  const fresh = await User.findById(channelId).select("subscribersCount");
  res.json({ subscribed: on, subscribersCount: Math.max(0, fresh.subscribersCount) });
});

export default router;
