import mongoose from "mongoose";

const { Schema } = mongoose;

const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    kind: { type: String, enum: ["image", "gif"], default: "image" },
    mime: { type: String, default: "" },
  },
  { _id: false }
);

const postSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    caption: { type: String, default: "", maxlength: 500 },
    images: { type: [imageSchema], default: [] },
  },
  { timestamps: true }
);

export const Post = mongoose.model("Post", postSchema);