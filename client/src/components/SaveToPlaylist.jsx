import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";

/* 🎵 Save: add this video to one of your playlists. Tap a playlist again to remove the video from it. */
export default function SaveToPlaylist({ videoId }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  function show() {
    if (!user) return navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    setOpen(true);
    setErr("");
    api("/playlists").then((d) => setLists(d.playlists)).catch((e) => setErr(e.message));
  }

  async function toggle(p) {
    const has = p.videoIds.includes(videoId);
    try {
      const r = has
        ? await api(`/playlists/${p.id}/videos/${videoId}`, { method: "DELETE" })
        : await api(`/playlists/${p.id}/videos`, { method: "POST", body: { videoId } });
      setLists((ls) => ls.map((x) => (x.id === p.id ? r.playlist : x)));
    } catch (e) {
      setErr(e.message);
    }
  }

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const created = await api("/playlists", { method: "POST", body: { title: name.trim() } });
      const added = await api(`/playlists/${created.playlist.id}/videos`, { method: "POST", body: { videoId } });
      setLists((ls) => [added.playlist, ...ls]);
      setName("");
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <>
      <button className="pill" onClick={show}>🎵 Save</button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Save to playlist</b>
              <button className="icon-plain" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            {err && <p className="error">{err}</p>}
            <div className="sheet-scroll">
              {lists.length === 0 && <p className="muted small">No playlists yet. Create one below.</p>}
              {lists.map((p) => {
                const on = p.videoIds.includes(videoId);
                return (
                  <button key={p.id} className="playlist-opt" onClick={() => toggle(p)}>
                    <span className={on ? "check on" : "check"}>{on ? "✓" : ""}</span>
                    <span className="grow">{p.title}</span>
                    <small className="muted">{p.count} videos</small>
                  </button>
                );
              })}
            </div>
            <form className="playlist-new" onSubmit={create}>
              <input placeholder="New playlist name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
              <button className="subscribe-btn" disabled={!name.trim()}>Create</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
