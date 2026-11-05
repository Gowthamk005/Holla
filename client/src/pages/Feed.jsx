import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { CATEGORIES, categoryLabel } from "../lib/constants.js";
import VideoCard from "../components/VideoCard.jsx";
import ShortsRow from "../components/ShortsRow.jsx";
import ContinueRow from "../components/ContinueRow.jsx";

/* Home (/), Trending (/trending), category (/category/:cat) and hashtag (/tag/:tag) pages */
export default function Feed({ mode = "home" }) {
  const { cat, tag } = useParams();
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [chip, setChip] = useState("all");
  const [videos, setVideos] = useState(null);
  const [err, setErr] = useState("");

  const category = mode === "category" ? cat : chip === "all" ? "" : chip;
  const sort = mode === "trending" ? "views" : "latest";

  useEffect(() => {
    setVideos(null);
    setErr("");
    const qs = new URLSearchParams({ sort });
    // home, trending and category pages show normal videos; hashtag pages show everything with that tag
    if (mode !== "tag") qs.set("format", "video");
    if (category) qs.set("category", category);
    if (mode === "tag" && tag) qs.set("tag", tag);
    if (q) qs.set("q", q);
    api(`/videos?${qs}`).then((d) => setVideos(d.videos)).catch((e) => setErr(e.message));
  }, [sort, category, q, tag, mode]);

  const title = q
    ? `Results for “${q}”`
    : mode === "tag" ? `#${tag}`
    : mode === "trending" ? "🔥 Trending"
    : mode === "category" ? `${CATEGORIES.find((c) => c.key === cat)?.icon || ""} ${categoryLabel(cat)}`
    : null;

  return (
    <div>
      {title && <h1 className="page-title">{title}</h1>}

      {mode === "home" && !q && <ContinueRow />}

      {mode === "home" && !q && (
        <div className="chips">
          <button className={chip === "all" ? "chip active" : "chip"} onClick={() => setChip("all")}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={chip === c.key ? "chip active" : "chip"} onClick={() => setChip(c.key)}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      )}

      {err && <p className="error">{err}</p>}
      {!err && videos === null && <p className="muted">Loading…</p>}
      {videos && videos.length === 0 && (
        <div className="empty">
          <h2>{mode === "tag" ? `No videos with #${tag} yet` : "No videos here yet"}</h2>
          <p>Tap + at the bottom to upload one.</p>
        </div>
      )}
      {videos && videos.length > 0 && (
        <div className="video-grid">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}

      {mode === "home" && !q && <ShortsRow />}
    </div>
  );
}
