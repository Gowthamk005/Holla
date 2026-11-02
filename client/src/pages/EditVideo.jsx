import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CATEGORIES } from "../lib/constants.js";
import { extractHashtags } from "../lib/hashtags.js";

/* Edit title, description, category and hashtags of your own video */
export default function EditVideo() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "movies" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    api(`/videos/${id}`)
      .then((d) => {
        setVideo(d.video);
        setForm({
          title: d.video.title,
          description: d.video.description || "",
          category: d.video.category,
        });
      })
      .catch((e) => setLoadErr(e.message));
  }, [id]);

  const tags = extractHashtags(`${form.title} ${form.description}`);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const r = await api(`/videos/${id}`, { method: "PATCH", body: form });
      setVideo(r.video);
      setMsg({ type: "ok", text: "Saved" });
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this video permanently? This cannot be undone.")) return;
    try {
      await api(`/videos/${id}`, { method: "DELETE" });
      navigate("/studio");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  if (loadErr) return <div className="empty"><h2>{loadErr}</h2><Link to="/studio">Back to Studio</Link></div>;
  if (!video) return <p className="muted">Loading…</p>;
  if (user && user.id !== video.owner.id && user.role !== "admin") {
    return <div className="empty"><h2>Not allowed</h2><p>You can only edit your own videos.</p></div>;
  }

  return (
    <div className="edit-page">
      <h1 className="page-title">✎ Edit video</h1>

      <div className="row">
        {video.thumbnailUrl
          ? <img className="edit-thumb" src={video.thumbnailUrl} alt="" />
          : <div className="edit-thumb thumb-empty">▶</div>}
        <div className="muted small">
          {video.format === "short" ? "Short (9:16)" : "Video (16:9)"} · {video.views} views
        </div>
      </div>

      <form className="card-form" onSubmit={save}>
        <label className="field-label">Title</label>
        <input
          maxLength={100}
          required
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <label className="field-label">Description</label>
        <textarea
          rows={5}
          maxLength={500}
          placeholder="Write a description. Add hashtags with # , for example #travel #tamil"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="tag-row">
          {tags.length === 0
            ? <span className="muted small">No hashtags yet. Type #yourtag in the title or description.</span>
            : tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
        </div>

        <label className="field-label">Category</label>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
          ))}
        </select>

        {msg.text && <p className={msg.type === "error" ? "error" : "ok-text"}>{msg.text}</p>}

        <div className="row">
          <button className="subscribe-btn" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          <button type="button" className="pill" onClick={() => navigate(-1)}>Cancel</button>
          <button type="button" className="pill danger" onClick={remove}>Delete video</button>
        </div>
      </form>

      <p className="muted small">
        Hashtags are read automatically from the title and description. Click any hashtag on the video page to see all videos with that tag.
      </p>
    </div>
  );
}
