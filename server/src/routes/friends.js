import { Router } from "express";
import { Friendship, findBetween } from "../models/Friendship.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { mini, pubUser } from "../utils/serialize.js";
import { emitToUser } from "../utils/realtime.js";

const router = Router();
router.use(requireAuth);

/* GET /api/friends -> { friends, incoming, outgoing } */
router.get("/", async (req, res) => {
  const me = req.user._id;
  const all = await Friendship.find({ $or: [{ requester: me }, { recipient: me }] })
    .populate("requester", "username name avatarUrl bannerUrl bio subscribersCount createdAt")
    .populate("recipient", "username name avatarUrl bannerUrl bio subscribersCount createdAt");

  const friends = [], incoming = [], outgoing = [];
  for (const f of all) {
    if (!f.requester || !f.recipient) continue;
    const iAmRequester = String(f.requester._id) === String(me);
    if (f.status === "accepted") friends.push(pubUser(iAmRequester ? f.recipient : f.requester));
    else if (iAmRequester) outgoing.push(pubUser(f.recipient));
    else incoming.push(pubUser(f.requester));
  }
  res.json({ friends, incoming, outgoing });
});

/* POST /api/friends/request  { userId } */
router.post("/request", async (req, res) => {
  const targetId = req.body?.userId;
  if (!isId(targetId)) fail(400, "Pick a valid person.");
  if (String(targetId) === String(req.user._id)) fail(400, "You cannot add yourself.");
  const target = await User.findById(targetId).select("_id");
  if (!target) fail(404, "User not found.");

  const existing = await findBetween(req.user._id, targetId);
  if (existing) {
    if (existing.status === "accepted") fail(400, "You are already friends.");
    if (String(existing.requester) === String(req.user._id)) fail(400, "Request already sent.");
    // they asked first: accepting now is the natural result
    existing.status = "accepted";
    await existing.save();
    emitToUser(targetId, "friends:update", { with: String(req.user._id) });
    return res.json({ status: "friends" });
  }

  await Friendship.create({ requester: req.user._id, recipient: targetId });
  emitToUser(targetId, "friends:update", { with: String(req.user._id) });
  res.status(201).json({ status: "pending_out" });
});

/* POST /api/friends/respond  { userId, accept } */
router.post("/respond", async (req, res) => {
  const { userId, accept } = req.body || {};
  if (!isId(userId)) fail(400, "Pick a valid person.");
  const f = await Friendship.findOne({ requester: userId, recipient: req.user._id, status: "pending" });
  if (!f) fail(404, "No pending request from this person.");

  if (accept) {
    f.status = "accepted";
    await f.save();
  } else {
    await Friendship.deleteOne({ _id: f._id });
  }
  emitToUser(userId, "friends:update", { with: String(req.user._id) });
  res.json({ status: accept ? "friends" : "none" });
});

export default router;
