import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import VideoCard from "../components/VideoCard.jsx";

export default function Library() {
  const { type } = useParams(); // "like" or "save"
  const [videos, setVideos] = useState(null);
  const title = type === "like" ? "♡ Liked videos" : "◷ Watch later";

  useEffect(() => {
    setVideos(null);
    api(`/me/library?type=${type}`).then((d) => setVideos(d.videos)).catch(() => setVideos([]));
  }, [type]);

  return (
    <div>
      <h1 className="page-title">{title}</h1>
      {videos === null && <p className="muted">Loading…</p>}
      {videos?.length === 0 && <div className="empty"><h2>Nothing here yet</h2><p>Tap {type === "like" ? "Like" : "Save"} on any video.</p></div>}
      {videos?.length > 0 && <div className="video-grid">{videos.map((v) => <VideoCard key={v.id} video={v} />)}</div>}
    </div>
  );
}
