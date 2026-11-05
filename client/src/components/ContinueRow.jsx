import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmtDuration } from "../lib/format.js";

/* "Continue watching": videos you started but did not finish. Shows nothing when you have none. */
export default function ContinueRow() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api("/history")
      .then((d) =>
        setItems(
          d.items
            .filter(({ video, position }) => video.duration > 0 && position > 10 && position < video.duration * 0.95)
            .slice(0, 12)
        )
      )
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <section className="continue-row">
      <h3 className="section-title">Continue watching</h3>
      <div className="continue-scroll">
        {items.map(({ video, position }) => {
          const pct = Math.min(100, Math.round((position / video.duration) * 100));
          const to = video.format === "short" ? `/shorts/${video.id}` : `/watch/${video.id}`;
          return (
            <Link to={to} key={video.id} className="continue-tile">
              <div className="continue-thumb">
                {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb-empty">▶</div>}
                <div className="continue-bar"><i style={{ width: `${pct}%` }} /></div>
              </div>
              <div className="continue-title">{video.title}</div>
              <div className="muted small">{fmtDuration(Math.max(0, video.duration - position))} left</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
