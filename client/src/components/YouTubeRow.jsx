import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import YouTubeCard from "./YouTubeCard.jsx";

/* Home-page strip. Shows nothing if YouTube is not set up on the server. */
export default function YouTubeRow() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    api("/youtube/status")
      .then((s) => (s.enabled ? api("/youtube/trending?limit=8") : null))
      .then((d) => d && setVideos(d.videos))
      .catch(() => setVideos([]));
  }, []);

  if (!videos.length) return null;
  return (
    <section>
      <div className="section-head">
        <h3 className="section-title">▶ Trending on YouTube</h3>
        <Link to="/youtube" className="muted-link">See all</Link>
      </div>
      <div className="video-grid">
        {videos.map((v) => <YouTubeCard key={v.id} video={v} />)}
      </div>
    </section>
  );
}
