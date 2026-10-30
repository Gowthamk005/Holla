import mongoose from "mongoose";

const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    video: { type: Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 500 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ video: 1, createdAt: -1 });

export const Comment = mongoose.model("Comment", commentSchema);