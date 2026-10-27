import { Router } from "express";
import { Friendship } from "../models/Friendship.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { OWNER_SELECT, pubUser } from "../utils/serialize.js";

const router = Router();
router.use(requireAuth);

/*
 * GET /api/people/suggestions -> { people: [{ user, reasons }] }
 * Score = mutual friends x3 + shared subscriptions x2 + shared interests x1.
 */
router.get("/suggestions", async (req, res) => {
  const me = req.user;
  const meId = String(me._id);

  const rels = await Friendship.find({ $or: [{ requester: me._id }, { recipient: me._id }] }).lean();
  const other = (r) => (String(r.requester) === meId ? String(r.recipient) : String(r.requester));
  const excluded = new Set(rels.map(other));
  excluded.add(meId);
  const myFriends = rels.filter((r) => r.status === "accepted").map(other);
  const friendSet = new Set(myFriends);

  // which of my friends are connected to each other person
  const mutual = new Map();
  if (myFriends.length) {
    const edges = await Friendship.find({
      status: "accepted",
      $or: [{ requester: { $in: myFriends } }, { recipient: { $in: myFriends } }],
    }).lean();
    for (const e of edges) {
      const a = String(e.requester), b = String(e.recipient);
      for (const [friend, person] of [[a, b], [b, a]]) {
        if (friendSet.has(friend) && !friendSet.has(person) && person !== meId) {
          if (!mutual.has(person)) mutual.set(person, new Set());
          mutual.get(person).add(friend);
        }
      }
    }
  }

  const candidates = await User.find({
    _id: { $nin: [...excluded] },
    disabled: { $ne: true },
  })
    .limit(200)
    .select(OWNER_SELECT + " interests");

  const mySubs = new Set((await Subscription.find({ subscriber: me._id }).lean()).map((s) => String(s.channel)));
  const candSubs = await Subscription.find({ subscriber: { $in: candidates.map((c) => c._id) } }).lean();
  const subsByUser = new Map();
  for (const s of candSubs) {
    const k = String(s.subscriber);
    if (!subsByUser.has(k)) subsByUser.set(k, new Set());
    subsByUser.get(k).add(String(s.channel));
  }

  const people = candidates
    .map((c) => {
      const id = String(c._id);
      const mutualFriends = [...(mutual.get(id) || [])];
      const shared = [...(subsByUser.get(id) || [])].filter((ch) => mySubs.has(ch)).length;
      const commonInterests = (c.interests || []).filter((i) => (me.interests || []).includes(i));

      const reasons = [];
      if (mutualFriends.length) reasons.push(`${mutualFriends.length} mutual friend${mutualFriends.length > 1 ? "s" : ""}`);
      if (shared) reasons.push(`Follows ${shared} channel${shared > 1 ? "s" : ""} you follow`);
      if (commonInterests.length) reasons.push(`Interested in ${commonInterests.join(", ")}`);
      if (!reasons.length) reasons.push("New on Olla");

      return {
        score: mutualFriends.length * 3 + shared * 2 + commonInterests.length,
        user: pubUser(c),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map(({ user, reasons }) => ({ user, reasons }));

  res.json({ people });
});

export default router;
