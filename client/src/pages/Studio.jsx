import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { CATEGORIES } from "../lib/constants.js";
import { fmtBytes, fmtCount, timeAgo, fmtDuration } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";

const MAX_MB = 500;

/* read the video length in the browser so the server can store it */
function getDuration(file) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.duration || 0); URL.revokeObjectURL(url); };
    v.onerror = () => { resolve(0); URL.revokeObjectURL(url); };
    v.src = url;
  });
}

/* Creator dashboard: profile, upload, and your videos with delete. */
export default function Studio() {
  const { user, setUser } = useAuth();
  const [videos, setVideos] = useState(null);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "movies" });
  const [file, setFile] = useState(null);
  const [thumb, setThumb] = useState(null);
  const [status, setStatus] = useState({ type: "", text: "" });
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({ name: "", bio: "" });

  const load = () => {
    api("/me/videos").then((d) => { setVideos(d.videos); setStats(d.stats); }).catch(() => setVideos([]));
  };

  useEffect(() => {
    load();
    if (user) setProfile({ name: user.name, bio: user.bio || "" });
  }, [user?.id]);

  async function upload(e) {
    e.preventDefault();
    if (!file) return setStatus({ type: "error", text: "Choose a video file." });
    if (!file.type.startsWith("video/")) return setStatus({ type: "error", text: "That file is not a video." });
    if (file.size > MAX_MB * 1024 * 1024) return setStatus({ type: "error", text: `Video must be under ${MAX_MB} MB.` });

    const fd = new FormData();
    fd.append("video", file);
    if (thumb) fd.append("thumb", thumb);
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    fd.append("duration", String(await getDuration(file)));

    setUploading(true);
    setStatus({ type: "", text: "Uploading…" });
    try {
      await api("/videos", { method: "POST", form: fd });
      setStatus({ type: "ok", text: "Video published 🎉" });
      setForm({ title: "", description: "", category: "movies" });
      setFile(null);
      setThumb(null);
      e.target.reset();
      load();
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this video permanently?")) return;
    try {
      await api(`/videos/${id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const { user: u } = await api("/me", { method: "PATCH", body: profile });
      setUser(u);
      setStatus({ type: "ok", text: "Profile saved" });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  return (
    <div className="studio">
      <h1 className="page-title">🎬 Studio</h1>

      <div className="stat-cards">
        <div className="stat-card"><span>{fmtCount(stats?.videos ?? 0)}</span><small>Videos</small></div>
        <div className="stat-card"><span>{fmtCount(stats?.views ?? 0)}</span><small>Total views</small></div>
        <div className="stat-card"><span>{fmtCount(user?.subscribersCount ?? 0)}</span><small>Subscribers</small></div>
        <div className="stat-card"><span>{fmtBytes(stats?.bytes ?? 0)}</span><small>Storage used</small></div>
      </div>

      {status.text && <p className={status.type === "error" ? "error" : "ok-text"}>{status.text}</p>}

      <div className="studio-grid">
        <form className="card-form" onSubmit={upload}>
          <h3>Upload a video</h3>
          <label className="file-drop">
            {file ? `${file.name} (${fmtBytes(file.size)})` : "Choose a video (MP4 recommended)"}
            <input type="file" accept="video/*" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>
          <label className="file-drop small-drop">
            {thumb ? thumb.name : "Thumbnail image (optional)"}
            <input type="file" accept="image/*" hidden onChange={(e) => setThumb(e.target.files[0] || null)} />
          </label>
          <input placeholder="Title" maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea placeholder="Description" maxLength={500} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button className="subscribe-btn" disabled={uploading}>{uploading ? "Uploading…" : "Publish"}</button>
        </form>

        <form className="card-form" onSubmit={saveProfile}>
          <h3>Your channel</h3>
          <div className="row"><Avatar user={user} size="lg" /><Link to={`/c/${user?.username}`} className="pill">View channel</Link></div>
          <input placeholder="Display name" maxLength={40} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
          <textarea placeholder="Bio" maxLength={300} rows={3} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
          <button className="subscribe-btn">Save profile</button>
        </form>
      </div>

      <h3 className="section-title">Your videos</h3>
      {videos === null && <p className="muted">Loading…</p>}
      {videos?.length === 0 && <p className="muted">Nothing uploaded yet.</p>}
      {videos?.map((v) => (
        <div className="studio-row" key={v.id}>
          <Link to={`/watch/${v.id}`} className="studio-thumb">
            {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <div className="thumb-empty">▶</div>}
          </Link>
          <div className="grow">
            <div className="tx-title">{v.title}</div>
            <div className="muted small">{v.category} · {fmtDuration(v.duration)} · {fmtBytes(v.size)} · {fmtCount(v.views)} views · {timeAgo(v.createdAt)}</div>
          </div>
          <button className="pill danger" onClick={() => remove(v.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
