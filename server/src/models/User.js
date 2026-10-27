import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      match: /^[a-z0-9_.]{3,20}$/,
    },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // empty for Google-only accounts
    passwordHash: { type: String, select: false },
    googleId: { type: String },
    email: { type: String, lowercase: true, trim: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    disabled: { type: Boolean, default: false },
    avatarUrl: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 300 },
    interests: { type: [String], default: [] },
    subscribersCount: { type: Number, default: 0, min: 0 },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export const User = mongoose.model("User", userSchema);
