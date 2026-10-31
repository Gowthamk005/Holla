import { Router } from "express";
import { WatchHistory } from "../models/History.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { OWNER_SELECT, videoOut } from "../utils/serialize.js";

/* Only the logged-in user's own history is ever returned or changed. */
const router = Router();
router.use(requireAuth);

/* GET /api/history -> { items: [{ video, position, updatedAt }] } (newest first) */
router.get("/", async (req, res) => {
  const items = await WatchHistory.find({ user: req.user._id })
    .sort({ updatedAt: -1 })
    .limit(300)
    .populate({ path: "video", populate: { path: "owner", select: OWNER_SELECT } });

  res.json({
    items: items
      .filter((i) => i.video && i.video.owner)
      .map((i) => ({ video: videoOut(i.video), position: i.position, updatedAt: i.updatedAt })),
  });
});

/* DELETE /api/history/:videoId  — remove one item */
router.delete("/:videoId", async (req, res) => {
  if (!isId(req.params.videoId)) fail(404, "Not found.");
  await WatchHistory.deleteOne({ user: req.user._id, video: req.params.videoId });
  res.json({ ok: true });
});

/* DELETE /api/history  — clear all of your history */
router.delete("/", async (req, res) => {
  await WatchHistory.deleteMany({ user: req.user._id });
  res.json({ ok: true });
});

export default router;
