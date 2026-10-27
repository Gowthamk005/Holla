import mongoose from "mongoose";
import { CATEGORIES } from "../config.js";

const { Schema } = mongoose;

const videoSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: "", maxlength: 500 },
    category: { type: String, enum: CATEGORIES, required: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },
    videoFile: { type: String, default: "" },
    thumbFile: { type: String, default: "" },
    duration: { type: Number, default: 0, min: 0 },
    size: { type: Number, default: 0, min: 0 },
    renditions: { type: [{ label: String, height: Number, url: String }], default: [] },
    views: { type: Number, default: 0, min: 0 },
    likesCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

videoSchema.index({ category: 1, createdAt: -1 });
videoSchema.index({ views: -1, createdAt: -1 });

export const Video = mongoose.model("Video", videoSchema);
