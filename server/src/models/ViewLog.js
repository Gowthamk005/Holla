import mongoose from "mongoose";

const { Schema } = mongoose;

const viewLogSchema = new Schema(
  {
    video: { type: Schema.Types.ObjectId, ref: "Video", required: true },
    viewer: { type: String, required: true }, // "u:<userId>" or "a:<browserId>"
  },
  { timestamps: true }
);

viewLogSchema.index({ video: 1, viewer: 1 }, { unique: true });

export const ViewLog = mongoose.model("ViewLog", viewLogSchema);