import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { findBetween } from "../models/Friendship.js";
import { requireAuth } from "../middleware/auth.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { msgOut, pubUser, mini } from "../utils/serialize.js";
import { emitToUser } from "../utils/realtime.js";
import { isOnline } from "../utils/presence.js";
import { uploadChat } from "../utils/chatUpload.js";
import { detectFile, LIMITS, sanitizeName } from "../utils/filetype.js";
import { removeUpload } from "../utils/media.js";

const router = Router();
router.use(requireAuth);

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const PUBLIC_FIELDS = "username name avatarUrl bannerUrl bio subscribersCount createdAt lastSeenAt";

const unreadFor = (userId) => Message.countDocuments({ to: userId, readAt: null });
const userPayload = (u) => ({ ...pubUser(u), online: isOnline(u._id), lastSeenAt: u.lastSeenAt || null });

function previewOf(m) {
  if (m.deletedAt) return "Message deleted";
  if (m.attachment?.url) return "📎 " + (m.text || m.attachment.type);
  return (m.text || "").slice(0, 60);
}

async function findRecipient(id) {
  if (!isId(id)) fail(404, "User not found.");
  const u = await User.findById(id).select(PUBLIC_FIELDS);
  if (!u) fail(404, "User not found.");
  return u;
}

/* saves the message, pushes it to both people in realtime, updates their unread counts.
   When the two are friends, the receiver also gets "chat:notify" (sender info) for the popup alert. */
async function deliver(message, sender) {
  const out = msgOut(message);
  emitToUser(message.from, "message:new", { message: out });
  emitToUser(message.to, "message:new", { message: out });
  emitToUser(message.to, "messages:unread", { count: await unreadFor(message.to) });
  if (sender) {
    const rel = await findBetween(message.from, message.to);
    if (rel?.status === "accepted") {
      emitToUser(message.to, "chat:notify", { message: out, sender: mini(sender) });
    }
  }
  return out;
}

const notifyBoth = (message) => {
  const out = msgOut(message);
  emitToUser(message.from, "message:update", { message: out });
  emitToUser(message.to, "message:update", { message: out });
  return out;
};

/* GET /api/messages/unread -> { count } */
router.get("/unread", async (req, res) => {
  res.json({ count: await unreadFor(req.user._id) });
});

/* GET /api/messages/threads -> { threads: [{ user, last, unread }] } */
router.get("/threads", async (req, res) => {
  const me = String(req.user._id);
  const recent = await Message.find({ $or: [{ from: me }, { to: me }], hiddenFor: { $ne: req.user._id } })
    .sort({ createdAt: -1 })
    .limit(500);

  const seen = new Map();
  for (const m of recent) {
    const other = String(m.from) === me ? String(m.to) : String(m.from);
    if (!seen.has(other)) seen.set(other, m);
  }

  const others = await User.find({ _id: { $in: [...seen.keys()] } }).select(PUBLIC_FIELDS);
  const byId = new Map(others.map((u) => [String(u._id), u]));

  const threads = [];
  for (const [otherId, last] of seen) {
    const u = byId.get(otherId);
    if (!u) continue;
    threads.push({
      user: userPayload(u),
      last: { from: String(last.from), preview: previewOf(last), createdAt: last.createdAt },
      unread: await Message.countDocuments({ from: otherId, to: me, readAt: null }),
    });
  }
  res.json({ threads });
});

/* GET /api/messages/:userId -> { user, messages } (oldest first) */
router.get("/:userId", async (req, res) => {
  const other = await findRecipient(req.params.userId);
  const me = req.user._id;
  const messages = await Message.find({
    $or: [
      { from: me, to: other._id },
      { from: other._id, to: me },
    ],
    hiddenFor: { $ne: me },
  })
    .sort({ createdAt: 1 })
    .limit(200);
  res.json({ user: userPayload(other), messages: messages.map(msgOut) });
});

/* POST /api/messages/:userId/read */
router.post("/:userId/read", async (req, res) => {
  if (!isId(req.params.userId)) fail(404, "User not found.");
  await Message.updateMany(
    { from: req.params.userId, to: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  emitToUser(req.user._id, "messages:unread", { count: await unreadFor(req.user._id) });
  res.json({ ok: true });
});

/* POST /api/messages/actions/delete  { ids: [...], mode: "me" | "everyone" } */
router.post("/actions/delete", async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).filter(isId))].slice(0, 200);
  if (!ids.length) fail(400, "Select at least one message.");
  const me = req.user._id;

  if (req.body?.mode !== "everyone") {
    // delete for me: only hides it on my side
    await Message.updateMany({ _id: { $in: ids }, $or: [{ from: me }, { to: me }] }, { $addToSet: { hiddenFor: me } });
    return res.json({ ok: true, mode: "me", ids });
  }

  // delete for everyone: only allowed for your own messages
  const mine = await Message.find({ _id: { $in: ids }, from: me });
  if (mine.length !== ids.length) fail(403, "You can only delete your own messages for everyone.");

  const messages = [];
  for (const m of mine) {
    if (m.attachment?.url) await removeUpload(m.attachment.url);
    m.text = "";
    m.attachment = undefined;
    m.deletedAt = m.deletedAt || new Date();
    await m.save();
    messages.push(notifyBoth(m));
  }
  res.json({ ok: true, mode: "everyone", messages });
});

/* POST /api/messages/:userId  { text } */
router.post("/:userId", async (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) fail(400, "Message is empty.");
  if (text.length > 2000) fail(400, "Message is too long (max 2000 characters).");
  const to = await findRecipient(req.params.userId);
  if (String(to._id) === String(req.user._id)) fail(400, "You cannot message yourself.");

  const message = await Message.create({ from: req.user._id, to: to._id, text });
  res.status(201).json({ message: await deliver(message, req.user) });
});

/* POST /api/messages/message/:messageId/react  { emoji } -> { message }
   Only the two people in the chat can react. Same emoji again removes your reaction. */
router.post("/message/:messageId/react", async (req, res) => {
  if (!isId(req.params.messageId)) fail(404, "Message not found.");
  const emoji = String(req.body?.emoji || "");
  if (!REACTIONS.includes(emoji)) fail(400, "Pick a reaction from the list.");
  const m = await Message.findById(req.params.messageId);
  if (!m || m.deletedAt) fail(404, "Message not found.");
  const me = String(req.user._id);
  if (String(m.from) !== me && String(m.to) !== me) fail(404, "Message not found.");
  const mine = m.reactions.find((r) => String(r.user) === me);
  m.reactions = m.reactions.filter((r) => String(r.user) !== me);
  if (!mine || mine.emoji !== emoji) m.reactions.push({ user: req.user._id, emoji });
  await m.save();
  res.json({ message: notifyBoth(m) });
});

/* POST /api/messages/:userId/attachment  (multipart: file, optional text = caption) */
router.post(
  "/:userId/attachment",
  (req, res, next) => uploadChat(req, res, (err) => (err ? next(err) : next())),
  async (req, res) => {
    const file = req.file;
    if (!file) fail(400, "Choose a file to send.");
    const to = await findRecipient(req.params.userId);
    if (String(to._id) === String(req.user._id)) fail(400, "You cannot message yourself.");

    const kind = detectFile(file.buffer, file.originalname);
    if (!kind) fail(400, "This file type is not allowed. Send photos, videos, audio, PDF, Word, Excel, PowerPoint, text or zip.");
    if (file.size > LIMITS[kind.type] * 1024 * 1024) {
      fail(413, `${kind.type[0].toUpperCase() + kind.type.slice(1)} files can be up to ${LIMITS[kind.type]} MB.`);
    }

    const caption = String(req.body?.text || "").trim().slice(0, 2000);
    const dir = path.join(config.uploadsDir, "chat");
    await fs.mkdir(dir, { recursive: true });
    const fileName = crypto.randomBytes(12).toString("hex") + "." + kind.ext;
    await fs.writeFile(path.join(dir, fileName), file.buffer);
    const url = `/uploads/chat/${fileName}`;

    try {
      const message = await Message.create({
        from: req.user._id,
        to: to._id,
        text: caption,
        attachment: { type: kind.type, url, name: sanitizeName(file.originalname), size: file.size, mime: kind.mime },
      });
      res.status(201).json({ message: await deliver(message, req.user) });
    } catch (err) {
      await removeUpload(url);
      throw err;
    }
  }
);

/* PATCH /api/messages/item/:id  { text }  (own text messages, within 15 minutes) */
router.patch("/item/:id", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Message not found.");
  const m = await Message.findById(req.params.id);
  if (!m) fail(404, "Message not found.");
  if (String(m.from) !== String(req.user._id)) fail(403, "You can only edit your own messages.");
  if (m.deletedAt) fail(400, "This message was deleted.");
  if (m.attachment?.url) fail(400, "Messages with attachments cannot be edited.");
  if (Date.now() - new Date(m.createdAt).getTime() > EDIT_WINDOW_MS) fail(400, "You can edit a message only within 15 minutes.");

  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 2000) fail(400, "Message must be 1 to 2000 characters.");

  m.text = text;
  m.editedAt = new Date();
  await m.save();
  res.json({ message: notifyBoth(m) });
});

/* DELETE /api/messages/item/:id  (delete for everyone) */
router.delete("/item/:id", async (req, res) => {
  if (!isId(req.params.id)) fail(404, "Message not found.");
  const m = await Message.findById(req.params.id);
  if (!m) fail(404, "Message not found.");
  if (String(m.from) !== String(req.user._id)) fail(403, "You can only delete your own messages.");

  if (m.attachment?.url) await removeUpload(m.attachment.url);
  m.text = "";
  m.attachment = undefined;
  m.deletedAt = m.deletedAt || new Date();
  await m.save();
  res.json({ message: notifyBoth(m) });
});

export default router;
