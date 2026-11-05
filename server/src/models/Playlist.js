import mongoose from "mongoose";

const { Schema } = mongoose;

/* A private list of videos. Only its owner can see or change it. */
const playlistSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    videos: { type: [{ type: Schema.Types.ObjectId, ref: "Video" }], default: [] },
  },
  { timestamps: true }
);

export const Playlist = mongoose.model("Playlist", playlistSchema);
