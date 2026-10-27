import { findBetween } from "../models/Friendship.js";

/* "none" | "pending_out" (I sent it) | "pending_in" (they sent it) | "friends" */
export async function friendStatus(meId, otherId) {
  const f = await findBetween(meId, otherId);
  if (!f) return "none";
  if (f.status === "accepted") return "friends";
  return String(f.requester) === String(meId) ? "pending_out" : "pending_in";
}
