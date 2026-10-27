import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { fmtCount, timeAgo } from "../lib/format.js";
import { categoryLabel } from "../lib/constants.js";
import Avatar from "../components/Avatar.jsx";
import SubscribeButton from "../components/SubscribeButton.jsx";
import VideoCard from "../components/VideoCard.jsx";
import VideoPlayer from "./VideoPlayer.jsx";

export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [related, setRelated] = useState([]);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setData(null);
    setErr("");
    setRelated([]);
    api(`/videos/${id}`)
      .then((d) => {
        setData(d);
        api(`/videos?category=${d.video.category}&limit=12`)
          .then((r) => setRelated(r.videos.filter((v) => v.id !== id)))
          .catch(() => {});
      })
      .catch((e) => setErr(e.message));
    api(`/videos/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id]);

  async function interact(type) {
    if (!user) return navigate(`/login?next=/watch/${id}`);
    const key = type === "like" ? "liked" : "saved";
    const on = !data.viewer[key];
    try {
      const r = await api(`/videos/${id}/interact`, { method: "POST", body: { type, on } });
      setData((d) => ({
        ...d,
        video: { ...d.video, likesCount: r.likesCount },
        viewer: { ...d.viewer, [key]: on },
      }));
    } catch (e) {
      alert(e.message);
    }
  }

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  if (err) return <div className="empty"><h2>{err}</h2><Link to="/">Back to Home</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;

  const { video, viewer } = data;
  const ch = video.owner;

  return (
    <div className="watch">
      <div className="watch-main">
      <VideoPlayer key={video.id} video={video} />
        <h1 className="watch-title">{video.title}</h1>

        <div className="watch-bar">
          <div className="channel-row">
            <Link to={`/c/${ch.username}`}><Avatar channel={ch} size="md" /></Link>
            <div className="channel-text">
              <Link to={`/c/${ch.username}`} className="channel-name">{ch.name}</Link>
              <div className="muted small">{fmtCount(ch.subscribersCount)} subscribers</div>
            </div>
            <SubscribeButton channel={ch} subscribed={viewer.subscribed} showCount={false} />
          </div>
          <div className="action-row">
            <button className={viewer.liked ? "pill on" : "pill"} onClick={() => interact("like")}>👍 {fmtCount(video.likesCount)}</button>
            <button className={viewer.saved ? "pill on" : "pill"} onClick={() => interact("save")}>{viewer.saved ? "🔖 Saved" : "🔖 Save"}</button>
            <button className="pill" onClick={share}>{copied ? "Link copied ✓" : "↗ Share"}</button>
          </div>
        </div>

        <div className="description">
          <div className="muted small">
            {fmtCount(video.views)} views · {timeAgo(video.createdAt)} · {categoryLabel(video.category)}
          </div>
          <p>{video.description || "No description."}</p>
        </div>
      </div>

      <aside className="related">
        <h3>Up next</h3>
        {related.length === 0 && <p className="muted small">No more videos in this category yet.</p>}
        {related.map((v) => <VideoCard key={v.id} video={v} compact />)}
      </aside>
    </div>
  );
}
