/*
 * One-time: adds hashtags to videos uploaded before this feature.
 *   cd server
 *   node src/scripts/backfillHashtags.js
 */
import mongoose from "mongoose";
import { connectDB } from "../db.js";
import { Video } from "../models/Video.js";
import { extractHashtags } from "../utils/hashtags.js";

await connectDB();
let count = 0;
for await (const v of Video.find({}).select("title description").cursor()) {
  await Video.updateOne({ _id: v._id }, { $set: { hashtags: extractHashtags(`${v.title} ${v.description || ""}`) } });
  count++;
}
console.log(`Updated hashtags on ${count} videos.`);
await mongoose.disconnect();
