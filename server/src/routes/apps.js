import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { App, APP_CATEGORIES } from "../models/App.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { uploadIcon } from "../utils/iconUpload.js";
import { detectFile } from "../utils/filetype.js";
import { removeUpload } from "../utils/media.js";

const router = Router();

const appOut = (a) => ({
  id: String(a._id),
  name: a.name,
  category: a.category,
  url: a.url,
  iconUrl: a.iconUrl || "",
  description: a.description || "",
  active: a.active,
  order: a.order,
});

const toBool = (v, fallback) =>
  v === undefined || v === "" ? fallback : v === true || v === "true" || v === "on" || v === "1";

function cleanFields(body) {
  const name = String(body.name || "").trim();
  if (!name || name.length > 40) fail(400, "App name is required (max 40 characters).");

  const category = String(body.category || "other");
  if (!APP_CATEGORIES.includes(category)) fail(400, "Pick a valid category.");

  let url;
  try {
    url = new URL(String(body.url || "").trim());
  } catch {
    fail(400, "App link must be a full web address, for example https://www.swiggy.com");
  }
  if (!["http:", "https:"].includes(url.protocol)) fail(400, "App link must start with http:// or https://");

  const iconUrl = String(body.iconUrl || "").trim();
  if (iconUrl && !/^https?:\/\//.test(iconUrl) && !iconUrl.startsWith("/uploads/")) {
    fail(400, "Icon link must start with https:// (or leave it empty and upload an image).");
  }

  return {
    name,
    category,
    url: url.toString(),
    description: String(body.description || "").trim().slice(0, 200),
    active: toBool(body.active, true),
    iconUrl: iconUrl.slice(0, 300),
  };
}

/* saves an uploaded icon after checking it really is an image */
async function saveIcon(file) {
  if (!file) return null;
  const kind = detectFile(file.buffer, file.originalname);
  if (!kind || kind.type !== "image") fail(400, "Icon must be a PNG, JPG, GIF or WebP image.");
  const dir = path.join(config.uploadsDir, "apps");
  await fs.mkdir(dir, { recursive: true });
  const name = crypto.randomBytes(10).toString("hex") + "." + kind.ext;
  await fs.writeFile(path.join(dir, name), file.buffer);
  return `/uploads/apps/${name}`;
}

/* GET /api/apps -> active apps, for the Apps page */
router.get("/", async (req, res) => {
  const list = await App.find({ active: true }).sort({ category: 1, order: 1, createdAt: -1 });
  res.json({ apps: list.map(appOut) });
});

/* GET /api/apps/all -> every app, for admins */
router.get("/all", requireAuth, requireAdmin, async (req, res) => {
  const list = await App.find().sort({ category: 1, order: 1, createdAt: -1 });
  res.json({ apps: list.map(appOut) });
});

/* POST /api/apps  (admin, multipart: name, category, url, description, active, icon file or iconUrl) */
router.post("/", requireAuth, requireAdmin, uploadIcon, async (req, res) => {
  const data = cleanFields(req.body || {});
  const icon = await saveIcon(req.file);
  try {
    const doc = await App.create({ ...data, iconUrl: icon || data.iconUrl });
    res.status(201).json({ app: appOut(doc) });
  } catch (err) {
    await removeUpload(icon);
    throw err;
  }
});

/* PATCH /api/apps/:id  (admin) */
router.patch("/:id", requireAuth, requireAdmin, uploadIcon, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "App not found.");
  const doc = await App.findById(req.params.id);
  if (!doc) fail(404, "App not found.");

  const data = cleanFields(req.body || {});
  const newIcon = await saveIcon(req.file);
  if (newIcon) {
    await removeUpload(doc.iconUrl);
    doc.iconUrl = newIcon;
  } else if (data.iconUrl !== doc.iconUrl) {
    await removeUpload(doc.iconUrl);
    doc.iconUrl = data.iconUrl;
  }

  Object.assign(doc, { name: data.name, category: data.category, url: data.url, description: data.description, active: data.active });
  await doc.save();
  res.json({ app: appOut(doc) });
});

/* DELETE /api/apps/:id  (admin) */
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  if (!isId(req.params.id)) fail(404, "App not found.");
  const doc = await App.findById(req.params.id);
  if (!doc) fail(404, "App not found.");
  await removeUpload(doc.iconUrl);
  await App.deleteOne({ _id: doc._id });
  res.json({ ok: true });
});

export default router;
