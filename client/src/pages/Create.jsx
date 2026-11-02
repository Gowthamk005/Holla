import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { CATEGORIES } from "../lib/constants.js";
import { extractHashtags } from "../lib/hashtags.js";

const TABS = [
  { key: "video", label: "Video", icon: "🎬", title: "Upload a video", text: "Landscape video, 16:9, like YouTube." },
  { key: "short", label: "Short", icon: "📱", title: "Upload a short", text: "Vertical video, 9:16, for phones." },
  { key: "live", label: "Live", icon: "🔴", title: "Go live", text: "Live streaming needs a streaming service. Coming soon." },
  { key: "post", label: "Post", icon: "🖼️", title: "Share photos and GIFs", text: "Posts appear on your profile." },
];

export default function Create() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const thumbRef = useRef(null);
  const [tab, setTab] = useState("video");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [thumb, setThumb] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", category: "movies", caption: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const info = TABS.find((t) => t.key === tab);
  const hasSelection = tab === "post" ? images.length > 0 : !!file;
  const tags = extractHashtags(`${form.title} ${form.description}`);

  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setImageUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function switchTab(key) {
    setTab(key);
    setFile(null);
    setPreview("");
    setImages([]);
    setThumb(null);
    setMsg({ type: "", text: "" });
  }

  // checks the shape of the chosen video before the details step
  function chooseVideo(f) {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const w = probe.videoWidth;
      const h = probe.videoHeight;
      if (tab === "video" && h > w * 0.85) {
        setMsg({ type: "error", text: "This looks vertical. Choose Short (9:16) instead." });
      } else if (tab === "short" && w > h * 0.85) {
        setMsg({ type: "error", text: "This looks landscape. Choose Video (16:9) instead." });
      } else {
        setMsg({ type: "", text: "" });
      }
    };
    probe.src = url;
  }

  function onPick(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (tab === "post") setImages(files.slice(0, 10));
    else chooseVideo(files[0]);
  }

  async function publish(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg({ type: "", text: "Uploading…" });
    try {
      if (tab === "post") {
        const fd = new FormData();
        images.forEach((i) => fd.append("images", i));
        fd.append("caption", form.caption);
        await api("/posts", { method: "POST", form: fd });
      } else {
        const fd = new FormData();
        fd.append("video", file);
        if (thumb) fd.append("thumb", thumb);
        fd.append("title", form.title);
        fd.append("description", form.description);
        fd.append("category", form.category);
        fd.append("format", tab);
        await api("/videos", { method: "POST", form: fd });
      }
      navigate("/me");
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="create-page">
      <button className="create-close" onClick={() => navigate("/")} aria-label="Close">✕</button>

      <div className="create-body">
        {!hasSelection ? (
          <div className="create-intro">
            <div className="create-icon">{info.icon}</div>
            <h2>{info.title}</h2>
            <p className="muted">{info.text}</p>
            {tab !== "live" && (
              <button className="create-primary" onClick={() => fileRef.current.click()}>
                {tab === "post" ? "Choose photos or GIFs" : "Choose from gallery"}
              </button>
            )}
            {tab === "live" && <button className="create-primary" disabled>Coming soon</button>}
          </div>
        ) : tab === "post" ? (
          <form className="create-form" onSubmit={publish}>
            <div className="post-preview">
              {imageUrls.map((u) => <img key={u} src={u} alt="" />)}
            </div>
            <textarea rows={3} maxLength={500} placeholder="Write a caption… use #hashtags" value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            <button type="button" className="pill" onClick={() => fileRef.current.click()}>Change photos</button>
            {msg.text && <p className={msg.type === "error" ? "error" : "ok-text"}>{msg.text}</p>}
            <button className="create-primary" disabled={busy}>{busy ? "Posting…" : "Post"}</button>
          </form>
        ) : (
          <form className="create-form" onSubmit={publish}>
            <video className="create-preview" src={preview} controls playsInline />

            <label className="field-label">Title</label>
            <input placeholder="Title (add #hashtags here too)" maxLength={100} value={form.title} required
              onChange={(e) => setForm({ ...form, title: e.target.value })} />

            <label className="field-label">Description</label>
            <textarea rows={4} maxLength={500}
              placeholder="Describe your video. Add hashtags like #travel #tamil #vlog"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="tag-row">
              {tags.length === 0
                ? <span className="muted small">Hashtags you type with # will appear here.</span>
                : tags.map((t) => <span key={t} className="tag-chip">#{t}</span>)}
            </div>

            <label className="field-label">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>

            <button type="button" className="pill" onClick={() => thumbRef.current.click()}>
              {thumb ? `Thumbnail: ${thumb.name}` : "Add thumbnail (optional, made automatically if empty)"}
            </button>
            <input ref={thumbRef} type="file" accept="image/*" hidden onChange={(e) => setThumb(e.target.files[0] || null)} />

            {msg.text && <p className={msg.type === "error" ? "error" : "ok-text"}>{msg.text}</p>}

            <button className="create-primary" disabled={busy || msg.type === "error"}>
              {busy ? "Publishing…" : `Publish ${tab === "short" ? "Short" : "video"}`}
            </button>
            <button type="button" className="pill" onClick={() => switchTab(tab)}>Choose a different file</button>
          </form>
        )}
      </div>

      <input ref={fileRef} type="file" hidden multiple={tab === "post"}
        accept={tab === "post" ? "image/*" : "video/*"} onChange={onPick} />

      <nav className="create-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "create-tab active" : "create-tab"} onClick={() => switchTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
