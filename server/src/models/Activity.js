import mongoose from "mongoose";

const { Schema } = mongoose;

/* Time spent per user per day: "app" = seconds with Holla open, "watch" = seconds of video played */
const activitySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  day: { type: String, required: true }, // "YYYY-MM-DD"
  app: { type: Number, default: 0, min: 0 },
  watch: { type: Number, default: 0, min: 0 },
});

activitySchema.index({ user: 1, day: 1 }, { unique: true });

export const Activity = mongoose.model("Activity", activitySchema);