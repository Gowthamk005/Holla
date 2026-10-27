import mongoose from "mongoose";

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    type: { type: String, enum: ["image", "video", "audio", "file"], required: true },
    url: { type: String, required: true },
    name: { type: String, default: "file" },
    size: { type: Number, default: 0 },
    mime: { type: String, default: "" },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", maxlength: 2000 },
    attachment: { type: attachmentSchema, default: undefined },
    readAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    hiddenFor: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

messageSchema.index({ from: 1, to: 1, createdAt: -1 });
messageSchema.index({ to: 1, readAt: 1 });

export const Message = mongoose.model("Message", messageSchema);
