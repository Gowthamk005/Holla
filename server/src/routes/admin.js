import { Router } from "express";
import { User } from "../models/User.js";
import { Video } from "../models/Video.js";
import { Subscription } from "../models/Subscription.js";
import { Transaction } from "../models/Wallet.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { OWNER_SELECT, pubUser, videoOut } from "../utils/serialize.js";
import { deleteVideoFiles } from "../utils/media.js";

const router = Router();
router.use(requireAuth, requireAdmin);

/* GET /api/admin/stats */
router.get("/stats", async (req, res) => {
  const [users, videos, subscriptions, payments, volume] = await Promise.all([
    User.countDocuments(),
    Video.countDocuments(),
    Subscription.countDocuments(),
    Transaction.countDocuments({ kind: "pay" }),
    Transaction.aggregate([{ $match: { kind: "pay" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  res.json({ users, videos, subscriptions, payments, volume: volume[0]?.total || 0 });
});

/* GET /api/admin/users */
router.get("/users", async (req, res) => {
  const list = await User.find().sort({ createdAt: -1 }).limit(500);
  res.json({
    users: list.map((u) => ({ ...pubUser(u), role: u.role, disabled: u.disabled })),
  });
});

/* PATCH /api/admin/users/:id  { disabled } */
router.patch("/users/:id", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "User not found.");
  if (String(req.params.id) === String(req.user._id)) fail(400, "You cannot disable your own account.");
  const r = await User.updateOne({ _id: req.params.id }, { disabled: !!req.body?.disabled });
  if (!r.matchedCount) fail(404, "User not found.");
  res.json({ ok: true });
});

/* GET /api/admin/videos */
router.get("/videos", async (req, res) => {
  const list = await Video.find().sort({ createdAt: -1 }).limit(300).populate("owner", OWNER_SELECT);
  res.json({ videos: list.filter((v) => v.owner).map(videoOut) });
});

/* DELETE /api/admin/videos/:id */
router.delete("/videos/:id", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Video not found.");
  const v = await Video.findById(req.params.id);
  if (!v) fail(404, "Video not found.");
  await deleteVideoFiles(v);
  await Video.deleteOne({ _id: v._id });
  res.json({ ok: true });
});

export default router;
