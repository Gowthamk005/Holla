import { useEffect, useState } from "react";
import { api } from "../api.js";
import YouTubeCard from "../components/YouTubeCard.jsx";

/* Search YouTube (or browse what's trending in your region). Results play on YouTube. */
export default function YouTube() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setVideos(null);
    setErr("");
    const path = query ? `/youtube/search?q=${encodeURIComponent(query)}` : "/youtube/trending?limit=24";
    api(path)
      .then((d) => setVideos(d.videos))
      .catch((e) => {
        setErr(e.message);
        setVideos([]);
      });
  }, [query]);

  function submit(e) {
    e.preventDefault();
    setQuery(text.trim());
  }

  return (
    <div>
      <h1 className="page-title">▶ YouTube</h1>
      <p className="muted small">Videos from YouTube. They play with YouTube's own player and are not stored on Olla.</p>

      <form className="yt-search" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search YouTube" />
        <button className="subscribe-btn" type="submit">Search</button>
        {query && <button type="button" className="pill" onClick={() => { setText(""); setQuery(""); }}>Clear</button>}
      </form>

      {query && <h3 className="section-title">Results for “{query}”</h3>}
      {!query && <h3 className="section-title">Trending now</h3>}

      {err && <p className="error">{err}</p>}
      {!err && videos === null && <p className="muted">Loading…</p>}
      {videos && videos.length === 0 && !err && <p className="muted">No videos found.</p>}
      {videos?.length > 0 && (
        <div className="video-grid">
          {videos.map((v) => <YouTubeCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  );
}
