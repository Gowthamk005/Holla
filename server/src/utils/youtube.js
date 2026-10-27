/* Pure helpers (no imports) so they can be tested without the network. */

/* "PT1H2M10S" -> 3730 seconds */
export function parseDuration(iso = "") {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

/* Turns a YouTube "videos" resource into the shape the React app uses */
export function mapYouTube(item) {
  const sn = item.snippet || {};
  const thumbs = sn.thumbnails || {};
  const thumb = (thumbs.high || thumbs.medium || thumbs.default || {}).url || "";
  return {
    source: "youtube",
    id: item.id,
    title: sn.title || "",
    description: (sn.description || "").slice(0, 1000),
    channelId: sn.channelId || "",
    channelTitle: sn.channelTitle || "",
    channelUrl: `https://www.youtube.com/channel/${sn.channelId || ""}`,
    thumbnailUrl: thumb,
    duration: parseDuration(item.contentDetails?.duration),
    views: Number(item.statistics?.viewCount || 0),
    createdAt: sn.publishedAt || null,
    embedUrl: `https://www.youtube.com/embed/${item.id}`,
    watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
  };
}
