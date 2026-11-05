import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import VideoCard from "../components/VideoCard.jsx";

/* /playlists (your list) and /playlists/:id (one playlist). Only you can see your playlists. */
export default function Playlists() {
  const { id } = useParams();
  return id ? <PlaylistView id={id} /> : <PlaylistList />;
}

function PlaylistList() {
  const [lists, setLists] = useState(null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");

  const load = () => api("/playlists").then((d) => setLists(d.playlists)).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await api("/playlists", { method: "POST", body: { title: title.trim() } });
      setTitle("");
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">🎵 Playlists</h1>
      <form className="playlist-new" onSubmit={create}>
        <input placeholder="New playlist name" maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="subscribe-btn" disabled={!title.trim()}>Create</button>
      </form>
      {err && <p className="error">{err}</p>}
      {lists === null && !err && <p className="muted">Loading…</p>}
      {lists?.length === 0 && (
        <div className="empty">
          <h2>No playlists yet</h2>
          <p>Create one here, or tap 🎵 Save under any video.</p>
        </div>
      )}
      <div className="people-grid">
        {lists?.map((p) => (
          <Link to={`/playlists/${p.id}`} key={p.id} className="row-card playlist-card">
            <b>{p.title}</b>
            <span className="muted small">{p.count} videos</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PlaylistView({ id }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api(`/playlists/${id}`).then(setData).catch((e) => setErr(e.message));
  }, [id]);

  async function remove(videoId) {
    try {
      const r = await api(`/playlists/${id}/videos/${videoId}`, { method: "DELETE" });
      setData((d) => ({ ...d, playlist: r.playlist, videos: d.videos.filter((v) => v.id !== videoId) }));
    } catch (e) {
      alert(e.message);
    }
  }

  async function deletePlaylist() {
    if (!window.confirm("Delete this playlist? Your videos are not deleted.")) return;
    try {
      await api(`/playlists/${id}`, { method: "DELETE" });
      navigate("/playlists");
    } catch (e) {
      alert(e.message);
    }
  }

  if (err) return <div className="empty"><h2>{err}</h2><Link to="/playlists">Back to playlists</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div>
      <Link to="/playlists" className="muted-link small">← All playlists</Link>
      <h1 className="page-title">{data.playlist.title}</h1>
      <div className="muted small">{data.videos.length} videos</div>
      <div className="action-row">
        <button className="pill" onClick={deletePlaylist}>Delete playlist</button>
      </div>
      {data.videos.length === 0 && <p className="muted">No videos yet. Tap 🎵 Save under a video to add it here.</p>}
      <div className="video-grid">
        {data.videos.map((v) => (
          <div key={v.id}>
            <VideoCard video={v} />
            <button className="pill" onClick={() => remove(v.id)}>Remove from playlist</button>
          </div>
        ))}
      </div>
    </div>
  );
}
