import mongoose from "mongoose";

const { Schema } = mongoose;

/* An app shown on the Apps page. Managed by admins. */
export const APP_CATEGORIES = ["food", "travel", "movies", "shopping", "other"];

const appSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    category: { type: String, enum: APP_CATEGORIES, default: "other" },
    url: { type: String, required: true },
    iconUrl: { type: String, default: "" },
    description: { type: String, default: "", maxlength: 200 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

appSchema.index({ active: 1, category: 1, order: 1 });

export const App = mongoose.model("App", appSchema);
