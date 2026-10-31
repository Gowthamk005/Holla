import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmtCount } from "../lib/format.js";

/* Home-page row of vertical Shorts (replaces the YouTube trending row) */
export default function ShortsRow() {
  const [shorts, setShorts] = useState([]);

  useEffect(() => {
    api("/videos?format=short&limit=12").then((d) => setShorts(d.videos)).catch(() => {});
  }, []);

  if (!shorts.length) return null;

  return (
    <section className="gap-top">
      <div className="section-head">
        <h3 className="section-title">📱 Shorts</h3>
        <Link to="/shorts" className="muted-link">See all</Link>
      </div>
      <div className="shorts-row">
        {shorts.map((v) => (
          <Link key={v.id} to={`/shorts/${v.id}`} className="short-tile">
            {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" loading="lazy" /> : <div className="thumb-empty">▶</div>}
            <div className="short-tile-title">{v.title}</div>
            <div className="muted small">{fmtCount(v.views)} views</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
