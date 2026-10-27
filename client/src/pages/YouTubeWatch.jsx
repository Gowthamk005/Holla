import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { fmtCount, timeAgo } from "../lib/format.js";

/* Plays a YouTube video inside an iframe using YouTube's official embed player. */
export default function YouTubeWatch() {
  const { id } = useParams();
  const [video, setVideo] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setVideo(null);
    setErr("");
    api(`/youtube/video/${id}`).then((d) => setVideo(d.video)).catch((e) => setErr(e.message));
  }, [id]);

  if (err) return <div className="empty"><h2>{err}</h2><Link to="/youtube">Back to YouTube</Link></div>;
  if (!video) return <p className="muted">Loading…</p>;

  return (
    <div className="watch">
      <div className="watch-main">
        <div className="player">
          <iframe
            src={`https://www.youtube.com/embed/${video.id}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <p className="small muted player-note">
            If this video shows an error, its owner has turned off playing it on other sites.
            Use "Open on YouTube" below to watch it.
          </p>
        </div>
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-bar">
          <div className="channel-row">
            <div className="channel-text">
              <a className="channel-name" href={video.channelUrl} target="_blank" rel="noopener noreferrer">{video.channelTitle}</a>
              <div className="muted small">Channel on YouTube</div>
            </div>
          </div>
          <div className="action-row">
            <a className="pill" href={video.watchUrl} target="_blank" rel="noopener noreferrer">▶ Open on YouTube</a>
          </div>
        </div>
        <div className="description">
          <div className="muted small">
            {fmtCount(video.views)} views{video.createdAt ? ` · ${timeAgo(video.createdAt)}` : ""}
          </div>
          <p>{video.description || "No description."}</p>
        </div>
      </div>
    </div>
  );
}
