import mongoose from "mongoose";

const { Schema } = mongoose;

/* DEMO wallet. Play money only. Amounts are integer paise (100 paise = Rs 1). */
const walletSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    balance: { type: Number, default: 0, min: 0 },
    pinHash: { type: String, default: "", select: false },
    pinFails: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

const transactionSchema = new Schema(
  {
    txId: { type: String, required: true, unique: true },
    from: { type: Schema.Types.ObjectId, ref: "User", default: null },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1 },
    kind: { type: String, enum: ["pay", "topup"], default: "pay" },
    note: { type: String, default: "", maxlength: 60 },
  },
  { timestamps: true }
);
transactionSchema.index({ from: 1, createdAt: -1 });
transactionSchema.index({ to: 1, createdAt: -1 });

/* a request: "from" asks, "to" is the person who must pay */
const requestSchema = new Schema(
  {
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true, min: 1 },
    note: { type: String, default: "", maxlength: 60 },
    status: { type: String, enum: ["pending", "paid", "declined"], default: "pending" },
  },
  { timestamps: true }
);
requestSchema.index({ to: 1, status: 1 });
requestSchema.index({ from: 1, createdAt: -1 });

export const Wallet = mongoose.model("Wallet", walletSchema);
export const Transaction = mongoose.model("Transaction", transactionSchema);
export const MoneyRequest = mongoose.model("MoneyRequest", requestSchema);
