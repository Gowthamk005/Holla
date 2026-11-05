import { Router } from "express";
import { Playlist } from "../models/Playlist.js";
import { Video } from "../models/Video.js";
import { requireAuth } from "../middleware/auth.js";
import { fail } from "../utils/errors.js";
import { isId } from "../utils/ids.js";
import { OWNER_SELECT, videoOut } from "../utils/serialize.js";

/* Playlists are private: you only ever see and change your own. */
const router = Router();
router.use(requireAuth);

const MAX_VIDEOS = 500;
const summary = (p) => ({
  id: String(p._id),
  title: p.title,
  count: p.videos.length,
  videoIds: p.videos.map((v) => String(v)),
});

async function ownPlaylist(req) {
  if (!isId(req.params.id)) fail(404, "Playlist not found.");
  const p = await Playlist.findOne({ _id: req.params.id, owner: req.user._id });
  if (!p) fail(404, "Playlist not found.");
  return p;
}

// GET /api/playlists -> { playlists }
router.get("/", async (req, res) => {
  const list = await Playlist.find({ owner: req.user._id }).sort({ updatedAt: -1 });
  res.json({ playlists: list.map(summary) });
});

// POST /api/playlists { title } -> { playlist }
router.post("/", async (req, res) => {
  const title = String(req.body?.title || "").trim();
  if (!title || title.length > 100) fail(400, "Give the playlist a name (max 100 characters).");
  const p = await Playlist.create({ owner: req.user._id, title, videos: [] });
  res.status(201).json({ playlist: summary(p) });
});

// GET /api/playlists/:id -> { playlist, videos }
router.get("/:id", async (req, res) => {
  const p = await ownPlaylist(req);
  const base = summary(p);
  await p.populate({ path: "videos", populate: { path: "owner", select: OWNER_SELECT } });
  const videos = p.videos.filter((v) => v && v.owner).map(videoOut);
  res.json({ playlist: base, videos });
});

// POST /api/playlists/:id/videos { videoId } -> { playlist }
router.post("/:id/videos", async (req, res) => {
  const p = await ownPlaylist(req);
  const videoId = String(req.body?.videoId || "");
  if (!isId(videoId) || !(await Video.exists({ _id: videoId }))) fail(404, "Video not found.");
  if (!p.videos.some((v) => String(v) === videoId)) {
    if (p.videos.length >= MAX_VIDEOS) fail(400, `A playlist can hold up to ${MAX_VIDEOS} videos.`);
    p.videos.push(videoId);
    await p.save();
  }
  res.json({ playlist: summary(p) });
});

// DELETE /api/playlists/:id/videos/:videoId -> { playlist }
router.delete("/:id/videos/:videoId", async (req, res) => {
  const p = await ownPlaylist(req);
  p.videos = p.videos.filter((v) => String(v) !== req.params.videoId);
  await p.save();
  res.json({ playlist: summary(p) });
});

// DELETE /api/playlists/:id -> { ok }  (the videos themselves are not deleted)
router.delete("/:id", async (req, res) => {
  const p = await ownPlaylist(req);
  await p.deleteOne();
  res.json({ ok: true });
});

export default router;
