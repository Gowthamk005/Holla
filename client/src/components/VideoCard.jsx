import { Link } from "react-router-dom";
import Avatar from "./Avatar.jsx";
import { fmtCount, fmtDuration, timeAgo } from "../lib/format.js";

export default function VideoCard({ video, compact = false }) {
  const owner = video.owner || {};
  return (
    <div className={compact ? "video-card compact" : "video-card"}>
      <Link to={`/watch/${video.id}`} className="thumb-wrap">
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb-empty">▶</div>}
        <span className="duration">{fmtDuration(video.duration)}</span>
      </Link>
      <div className="video-info">
        {!compact && <Link to={`/c/${owner.username}`}><Avatar channel={owner} size="sm" /></Link>}
        <div className="video-text">
          <Link to={`/watch/${video.id}`} className="video-title">{video.title}</Link>
          <div className="video-meta">
            <Link to={`/c/${owner.username}`} className="muted-link">{owner.name}</Link>
            <div>{fmtCount(video.views)} views · {timeAgo(video.createdAt)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
