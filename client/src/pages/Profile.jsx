import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { fmtCount, fmtDuration, timeAgo } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";
import VideoCard from "../components/VideoCard.jsx";

const TABS = [
  ["videos", "Videos"],
  ["shorts", "Shorts"],
  ["posts", "Posts"],
  ["history", "History"],
];

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [tab, setTab] = useState("videos");
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api("/me/videos").then((d) => { setVideos(d.videos); setStats(d.stats); }).catch(() => {});
    api(`/posts/by/${user.username}`).then((d) => setPosts(d.posts)).catch(() => {});
    api("/me/history").then((d) => setHistory(d.items)).catch(() => {});
  }, [user?.id]);

  async function changePicture(file) {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const r = await api("/me/avatar", { method: "POST", form: fd });
      setUser(r.user); // the new picture also appears in chats
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  const longVideos = videos.filter((v) => v.format !== "short");
  const shorts = videos.filter((v) => v.format === "short");

  return (
    <div className="channel">
      <div className="banner" />
      <div className="channel-head">
        <div className="avatar-edit">
          <Avatar user={user} size="xl" />
          <button className="avatar-camera" onClick={() => fileRef.current.click()} disabled={busy} aria-label="Change profile picture">📷</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden
            onChange={(e) => { changePicture(e.target.files[0]); e.target.value = ""; }} />
        </div>
        <div className="channel-id">
          <h1>{user.name}</h1>
          <div className="muted">
            @{user.username} · {fmtCount(user.subscribersCount)} subscribers · {videos.length} uploads · {fmtCount(stats?.views || 0)} views
          </div>
          <p className="bio">{user.bio || "Add a bio in Settings."}</p>
          <div className="channel-actions">
            <button className="pill" onClick={() => navigate("/settings")} aria-label="Settings">⚙ Settings</button>
            <Link className="pill" to={`/c/${user.username}`}>Public channel</Link>
          </div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? "tab active" : "tab"} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "videos" && (
        longVideos.length === 0
          ? <div className="empty"><h2>No videos yet</h2><p>Tap + to upload your first video.</p></div>
          : <div className="video-grid">{longVideos.map((v) => <VideoCard key={v.id} video={v} />)}</div>
      )}

      {tab === "shorts" && (
        shorts.length === 0
          ? <div className="empty"><h2>No shorts yet</h2><p>Tap + and choose Short for vertical clips.</p></div>
          : <div className="shorts-grid">{shorts.map((v) => (
              <Link key={v.id} to={`/watch/${v.id}`} className="short-card">
                <img src={v.thumbnailUrl || ""} alt="" />
                <div className="short-title">{v.title}</div>
                <div className="muted small">{fmtCount(v.views)} views</div>
              </Link>
            ))}</div>
      )}

      {tab === "posts" && (
        posts.length === 0
          ? <div className="empty"><h2>No posts yet</h2><p>Tap + and choose Post to share photos or GIFs.</p></div>
          : <div className="post-grid">{posts.map((p) => (
              <div key={p.id} className="post-card">
                <img src={p.images[0].url} alt="" />
                {p.images.length > 1 && <span className="post-count">+{p.images.length - 1}</span>}
                {p.caption && <div className="post-caption">{p.caption}</div>}
              </div>
            ))}</div>
      )}

      {tab === "history" && (
        history.length === 0
          ? <div className="empty"><h2>No watch history yet</h2><p>Videos you watch will show here.</p></div>
          : history.map((h) => (
              <Link key={h.video.id} to={`/watch/${h.video.id}`} className="history-row">
                <img src={h.video.thumbnailUrl || ""} alt="" />
                <div className="grow">
                  <div className="tx-title">{h.video.title}</div>
                  <div className="muted small">{h.video.owner.name} · stopped at {fmtDuration(h.position)} · {timeAgo(h.updatedAt)}</div>
                </div>
              </Link>
            ))
      )}
    </div>
  );
}