import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import VideoCard from "../components/VideoCard.jsx";
import Avatar from "../components/Avatar.jsx";

export default function Subscriptions() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/me/subscriptions").then(setData).catch(() => setData({ channels: [], videos: [] }));
  }, []);
  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h1 className="page-title">▣ Subscriptions</h1>
      {data.channels.length === 0 ? (
        <div className="empty"><h2>No subscriptions yet</h2><p>Open a creator's page and press Subscribe. Their newest videos will show here.</p><Link to="/people" className="subscribe-btn">Find people</Link></div>
      ) : (
        <>
          <div className="channel-strip">
            {data.channels.map((c) => (
              <Link key={c.id} to={`/c/${c.username}`} className="strip-channel">
                <Avatar channel={c} size="md" />
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
          <div className="video-grid">{data.videos.map((v) => <VideoCard key={v.id} video={v} />)}</div>
        </>
      )}
    </div>
  );
}
