import mongoose from "mongoose";

const { Schema } = mongoose;

/* one document per (user, video, type): type is "like" or "save" */
const interactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    video: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    type: { type: String, enum: ["like", "save"], required: true },
  },
  { timestamps: true }
);

interactionSchema.index({ user: 1, video: 1, type: 1 }, { unique: true });
interactionSchema.index({ user: 1, type: 1, createdAt: -1 });

export const Interaction = mongoose.model("Interaction", interactionSchema);
