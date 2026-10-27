import mongoose from "mongoose";

const { Schema } = mongoose;

const friendshipSchema = new Schema(
  {
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

friendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });
friendshipSchema.index({ recipient: 1, status: 1 });

export const Friendship = mongoose.model("Friendship", friendshipSchema);

/* the friendship between two users, whichever way the request went */
export const findBetween = (a, b) =>
  Friendship.findOne({
    $or: [{ requester: a, recipient: b }, { requester: b, recipient: a }],
  });
