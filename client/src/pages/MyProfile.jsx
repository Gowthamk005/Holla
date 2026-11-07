import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { alertsOn, setAlerts } from "../lib/notify.js";
import Avatar from "../components/Avatar.jsx";

/* Your profile (bottom "You" tab): settings, channel, watch history, playlists, saved videos, more. */
export default function MyProfile() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState(null);
  const [playlists, setPlaylists] = useState(null);
  const [saved, setSaved] = useState(null);
  const [q, setQ] = useState("");
  const [alerts, setAlertsState] = useState(alertsOn);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/history").then((d) => setHistory(d.items.filter((i) => i.video).slice(0, 12))).catch(() => setHistory([]));
    api("/playlists").then((d) => setPlaylists(d.playlists)).catch(() => setPlaylists([]));
    api("/me/library?type=save").then((d) => setSaved(d.videos.slice(0, 12))).catch(() => setSaved([]));
  }, []);

  function search(e) {
    e.preventDefault();
    if (q.trim()) navigate(`/?q=${encodeURIComponent(q.trim())}`);
  }

  async function toggleAlerts() {
    const next = !alerts;
    setAlertsState(next);
    await setAlerts(next);
  }

  // uploads a new profile picture ("avatar") or banner ("banner"), then shows it everywhere
  async function uploadPicture(kind, file) {
    if (!file) return;
    setBusy(kind);
    setErr("");
    const fd = new FormData();
    fd.append("image", file);
    try {
      const r = await api(`/me/${kind}`, { method: "POST", form: fd });
      setUser(r.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function doLogout() {
    await logout();
    navigate("/");
  }

  if (!user) return null;

  const watchHref = (v) => (v.format === "short" ? `/shorts/${v.id}` : `/watch/${v.id}`);

  function Tiles({ items, loading, empty }) {
    if (loading) return <p className="muted small">Loading…</p>;
    if (!items.length) return <p className="muted small">{empty}</p>;
    return (
      <div className="mp-row">
        {items.map((v) => (
          <Link key={v.id} to={watchHref(v)} className="mp-tile">
            <div className="mp-thumb">
              {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" loading="lazy" /> : <div className="mp-noimg">▶</div>}
            </div>
            <div className="mp-tile-title">{v.title}</div>
          </Link>
        ))}
      </div>
    );
  }

  const historyVideos = history?.map((i) => i.video) || [];

  return (
    <div className="mp">
      <div className="mp-topbar">
        <form className="mp-search" onSubmit={search} role="search">
          <span aria-hidden="true">🔍</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos" aria-label="Search videos" />
        </form>
        <Link to="/settings" className="mp-settings">⚙ Settings</Link>
      </div>

      <section className="mp-banner-wrap">
        <div className="mp-banner" style={user.bannerUrl ? { backgroundImage: `url(${user.bannerUrl})` } : undefined}>
          <label className="pill mp-banner-btn">
            {busy === "banner" ? "Uploading…" : "📷 Change banner"}
            <input type="file" accept="image/*" hidden disabled={!!busy}
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; uploadPicture("banner", f); }} />
          </label>
        </div>
      </section>

      <section className="mp-head">
        <div className="mp-avatar-wrap">
          <Avatar user={user} size="lg" />
          <label className="mp-avatar-edit" title="Change profile picture" aria-label="Change profile picture">
            {busy === "avatar" ? "…" : "📷"}
            <input type="file" accept="image/*" hidden disabled={!!busy}
              onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; uploadPicture("avatar", f); }} />
          </label>
        </div>
        {err && <p className="error small">{err}</p>}
        <h1 className="mp-name">{user.name}</h1>
        <div className="muted small">@{user.username}</div>
        <Link to={`/c/${user.username}`} className="pill mp-channel">View channel</Link>
      </section>

      <section className="mp-section">
        <div className="mp-section-head">
          <h3 className="section-title">Watch history</h3>
          <Link to="/history" className="muted-link small">See all</Link>
        </div>
        <Tiles items={historyVideos} loading={history === null} empty="Videos you watch show up here." />
      </section>

      <section className="mp-section">
        <div className="mp-section-head">
          <h3 className="section-title">Playlist</h3>
          <Link to="/playlists" className="muted-link small">Manage</Link>
        </div>
        {playlists === null && <p className="muted small">Loading…</p>}
        {playlists?.length === 0 && (
          <p className="muted small">No playlists yet. <Link to="/playlists">Create one</Link></p>
        )}
        {playlists?.slice(0, 4).map((p) => (
          <Link key={p.id} to={`/playlists/${p.id}`} className="mp-playlist">
            <b>{p.title}</b>
            <span className="muted small">{p.count} videos</span>
          </Link>
        ))}
      </section>

      <section className="mp-section">
        <div className="mp-section-head">
          <h3 className="section-title">Saved videos</h3>
          <Link to="/library/save" className="muted-link small">See all</Link>
        </div>
        <Tiles items={saved || []} loading={saved === null} empty="Tap Save under a video to keep it here." />
      </section>

      <section className="mp-section mp-more">
        <h3 className="section-title">More</h3>
        <Link to="/studio">🎬 Studio</Link>
        <Link to="/wallet">💳 Olla Pay</Link>
        <Link to="/library/like">♡ Liked videos</Link>
        {user.role === "admin" && <Link to="/admin">🛠 Admin</Link>}
        <button onClick={toggleAlerts}>{alerts ? "🔔 Chat alerts: On" : "🔕 Chat alerts: Off"}</button>
        <button className="mp-logout" onClick={doLogout}>⎋ Log out</button>
      </section>
    </div>
  );
}
