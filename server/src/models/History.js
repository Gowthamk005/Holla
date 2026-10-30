import mongoose from "mongoose";

const { Schema } = mongoose;

const historySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    video: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    position: { type: Number, default: 0, min: 0 }, // seconds
  },
  { timestamps: true }
);

historySchema.index({ user: 1, video: 1 }, { unique: true });
historySchema.index({ user: 1, updatedAt: -1 });

export const WatchHistory = mongoose.model("WatchHistory", historySchema);