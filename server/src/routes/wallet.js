import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Wallet, Transaction, MoneyRequest } from "../models/Wallet.js";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { mini, txOut, reqOut } from "../utils/serialize.js";

/*
 * Olla Pay. DEMO ONLY: play money, not connected to any bank or UPI.
 * No database transactions are used, so this works on a standalone MongoDB.
 * Debit is a conditional update (balance >= amount), and a refund is made if the credit fails.
 */
const router = Router();
router.use(requireAuth);

const MAX_PAYMENT = 1000000; // Rs 10,000 in paise
const TOPUP_AMOUNT = 50000;  // Rs 500 in paise
const TOPUP_BELOW = 500000;  // top-up only while balance is under Rs 5,000

const WALLET_USER = "username name avatarUrl";
const txId = () => "T" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();

async function ensureWallet(userId) {
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { balance: config.demoStartBalance } },
    { upsert: true, new: true }
  );
}

async function checkPin(userId, pin) {
  const w = await Wallet.findOne({ user: userId }).select("+pinHash +pinFails +pinLockedUntil");
  if (!w?.pinHash) fail(400, "Set your Olla Pay PIN first.");

  if (w.pinLockedUntil && w.pinLockedUntil > new Date()) {
    const secs = Math.ceil((w.pinLockedUntil - Date.now()) / 1000);
    fail(429, `Too many wrong PINs. Try again in ${secs} seconds.`);
  }

  const ok = await bcrypt.compare(String(pin || ""), w.pinHash);
  if (!ok) {
    const fails = (w.pinFails || 0) + 1;
    const lock = fails >= 3;
    await Wallet.updateOne(
      { _id: w._id },
      { pinFails: lock ? 0 : fails, pinLockedUntil: lock ? new Date(Date.now() + 30000) : null }
    );
    fail(401, "Wrong PIN.");
  }
  if (w.pinFails) await Wallet.updateOne({ _id: w._id }, { pinFails: 0, pinLockedUntil: null });
}

/* GET /api/wallet */
router.get("/", async (req, res) => {
  const me = req.user._id;
  const w = await ensureWallet(me);
  const withPin = await Wallet.findById(w._id).select("+pinHash");

  const [txs, incoming, outgoing] = await Promise.all([
    Transaction.find({ $or: [{ from: me }, { to: me }] })
      .sort({ createdAt: -1 }).limit(30)
      .populate("from", WALLET_USER).populate("to", WALLET_USER),
    MoneyRequest.find({ to: me, status: "pending" }).sort({ createdAt: -1 })
      .populate("from", WALLET_USER).populate("to", WALLET_USER),
    MoneyRequest.find({ from: me }).sort({ createdAt: -1 }).limit(10)
      .populate("from", WALLET_USER).populate("to", WALLET_USER),
  ]);

  res.json({
    me: mini(req.user),
    balance: w.balance,
    hasPin: !!withPin.pinHash,
    transactions: txs.map(txOut),
    requests: { incoming: incoming.map(reqOut), outgoing: outgoing.map(reqOut) },
  });
});

/* POST /api/wallet/pin  { pin } (set once) */
router.post("/pin", async (req, res) => {
  const pin = String(req.body?.pin || "");
  if (!/^\d{4,6}$/.test(pin)) fail(400, "PIN must be 4 to 6 digits.");
  const w = await ensureWallet(req.user._id);
  const current = await Wallet.findById(w._id).select("+pinHash");
  if (current.pinHash) fail(400, "PIN is already set.");
  await Wallet.updateOne({ _id: w._id }, { pinHash: await bcrypt.hash(pin, 10) });
  res.json({ ok: true });
});

/* POST /api/wallet/pay  { toUsername, amount (paise), note, pin, requestId? } */
router.post("/pay", async (req, res) => {
  const me = req.user;
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount <= 0) fail(400, "Enter a valid amount.");
  if (amount > MAX_PAYMENT) fail(400, "Limit is Rs 10,000 per payment.");

  const target = await User.findOne({ username: String(req.body?.toUsername || "").toLowerCase() }).select("_id username");
  if (!target) fail(404, "No Olla account with that username.");
  if (String(target._id) === String(me._id)) fail(400, "You cannot pay yourself.");

  await checkPin(me._id, req.body?.pin);

  let request = null;
  if (req.body?.requestId) {
    if (!isId(req.body.requestId)) fail(400, "Unknown request.");
    request = await MoneyRequest.findOne({ _id: req.body.requestId, to: me._id, status: "pending" });
    if (!request) fail(400, "This request is no longer pending.");
    if (String(request.from) !== String(target._id) || request.amount !== amount) {
      fail(400, "Payment does not match the request.");
    }
  }

  await ensureWallet(me._id);
  await ensureWallet(target._id);

  const debited = await Wallet.findOneAndUpdate(
    { user: me._id, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );
  if (!debited) fail(400, "Not enough balance.");

  try {
    await Wallet.updateOne({ user: target._id }, { $inc: { balance: amount } });
  } catch (err) {
    await Wallet.updateOne({ user: me._id }, { $inc: { balance: amount } }); // refund
    throw err;
  }

  const tx = await Transaction.create({
    txId: txId(),
    from: me._id,
    to: target._id,
    amount,
    kind: "pay",
    note: String(req.body?.note || "").slice(0, 60),
  });
  if (request) await MoneyRequest.updateOne({ _id: request._id }, { status: "paid" });

  res.status(201).json({ ok: true, txId: tx.txId, balance: debited.balance - amount });
});

/* POST /api/wallet/request  { toUsername, amount, note } */
router.post("/request", async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_PAYMENT) fail(400, "Enter a valid amount.");
  const payer = await User.findOne({ username: String(req.body?.toUsername || "").toLowerCase() }).select("_id");
  if (!payer) fail(404, "No Olla account with that username.");
  if (String(payer._id) === String(req.user._id)) fail(400, "You cannot request money from yourself.");

  await MoneyRequest.create({
    from: req.user._id,
    to: payer._id,
    amount,
    note: String(req.body?.note || "").slice(0, 60),
  });
  res.status(201).json({ ok: true });
});

/* POST /api/wallet/requests/:id/decline */
router.post("/requests/:id/decline", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Request not found.");
  const r = await MoneyRequest.updateOne(
    { _id: req.params.id, to: req.user._id, status: "pending" },
    { status: "declined" }
  );
  if (!r.matchedCount) fail(404, "Request not found.");
  res.json({ ok: true });
});

/* POST /api/wallet/topup  (demo credit) */
router.post("/topup", async (req, res) => {
  const w = await ensureWallet(req.user._id);
  if (w.balance >= TOPUP_BELOW) fail(400, "Demo credit is only for balances under Rs 5,000.");
  await Wallet.updateOne({ _id: w._id }, { $inc: { balance: TOPUP_AMOUNT } });
  await Transaction.create({ txId: txId(), from: null, to: req.user._id, amount: TOPUP_AMOUNT, kind: "topup", note: "Demo credit" });
  res.json({ ok: true });
});

export default router;
