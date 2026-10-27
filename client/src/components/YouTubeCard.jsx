import { Link } from "react-router-dom";
import { fmtCount, fmtDuration, timeAgo } from "../lib/format.js";

/* A YouTube result. Clicking opens the Olla page that plays it with YouTube's own player. */
export default function YouTubeCard({ video }) {
  return (
    <div className="video-card">
      <Link to={`/youtube/${video.id}`} className="thumb-wrap">
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb-empty">▶</div>}
        <span className="duration">{fmtDuration(video.duration)}</span>
      </Link>
      <div className="video-info">
        <div className="video-text">
          <Link to={`/youtube/${video.id}`} className="video-title">{video.title}</Link>
          <div className="video-meta">
            <div className="muted-link">{video.channelTitle}</div>
            <div>{fmtCount(video.views)} views{video.createdAt ? ` · ${timeAgo(video.createdAt)}` : ""}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
