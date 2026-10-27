import { Router } from "express";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { mapYouTube } from "../utils/youtube.js";

/*
 * YouTube Data API v3 proxy. The API key never leaves the server.
 * Results are cached for 10 minutes to save daily quota
 * (default quota: 10,000 units/day; a search costs ~101 units, a trending list 1 unit).
 */
const router = Router();
const BASE = "https://www.googleapis.com/youtube/v3";
const TTL = 10 * 60 * 1000;
const cache = new Map();
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const PARTS = "snippet,contentDetails,statistics";

async function yt(resource, params) {
  if (!config.youtubeApiKey) fail(503, "YouTube is not set up yet. Add YOUTUBE_API_KEY to server/.env and restart.");

  const cacheKey = resource + JSON.stringify(params);
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.t < TTL) return hit.data;

  const qs = new URLSearchParams({ ...params, key: config.youtubeApiKey });
  let res;
  try {
    res = await fetch(`${BASE}/${resource}?${qs}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    fail(502, "Could not reach YouTube. Check the server's internet connection.");
  }
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      fail(503, "The YouTube daily quota is used up. Try again tomorrow.");
    }
    if (res.status === 400 || res.status === 403) fail(502, data?.error?.message || "YouTube rejected the request.");
    fail(502, "YouTube is unavailable right now.");
  }

  cache.set(cacheKey, { t: Date.now(), data });
  if (cache.size > 500) cache.clear();
  return data;
}

async function detailsFor(ids) {
  if (!ids.length) return [];
  const data = await yt("videos", { part: PARTS, id: ids.join(",") });
  return data.items || [];
}

/* GET /api/youtube/status -> { enabled, region } (no quota used) */
router.get("/status", (req, res) => {
  res.json({ enabled: !!config.youtubeApiKey, region: config.youtubeRegion });
});

/* GET /api/youtube/search?q=&limit= */
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);
  if (!q) fail(400, "Type something to search.");
  const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const found = await yt("search", {
    part: "snippet",
    type: "video",
    maxResults: String(limit),
    q,
    regionCode: config.youtubeRegion,
    safeSearch: "moderate",
  });
  const ids = (found.items || []).map((i) => i.id?.videoId).filter(Boolean);
  const details = new Map((await detailsFor(ids)).map((d) => [d.id, d]));
  // keep YouTube's ranking order
  const videos = ids.filter((id) => details.has(id)).map((id) => mapYouTube(details.get(id)));
  res.json({ videos });
});

/* GET /api/youtube/trending?limit= */
router.get("/trending", async (req, res) => {
  const limit = Math.min(25, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const data = await yt("videos", {
    part: PARTS,
    chart: "mostPopular",
    regionCode: config.youtubeRegion,
    maxResults: String(limit),
  });
  res.json({ videos: (data.items || []).map(mapYouTube) });
});

/* GET /api/youtube/video/:id */
router.get("/video/:id", async (req, res) => {
  if (!VIDEO_ID.test(req.params.id)) fail(404, "Video not found.");
  const [item] = await detailsFor([req.params.id]);
  if (!item) fail(404, "Video not found on YouTube.");
  res.json({ video: mapYouTube(item) });
});

export default router;
