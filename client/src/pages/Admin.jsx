import { useEffect, useState } from "react";
import { api } from "../api.js";
import { getSocket } from "../lib/socket.js";
import { fmtMoney, timeAgo } from "../lib/format.js";
import AppsAdmin from "../components/AppsAdmin.jsx";

/* Admin dashboard. Live numbers arrive over Socket.io every 2 seconds; totals are refreshed every 15 seconds. */
export default function Admin() {
  const [presence, setPresence] = useState({ online: 0, loggedIn: 0, guests: 0, byPage: {}, sessions: [] });
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [videos, setVideos] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const s = getSocket();
    s.emit("admin:join");
    const onPresence = (p) => setPresence(p);
    s.on("presence", onPresence);
    return () => {
      s.emit("admin:leave");
      s.off("presence", onPresence);
    };
  }, []);

  function load() {
    api("/admin/stats").then(setStats).catch((e) => setErr(e.message));
    api("/admin/users").then((d) => setUsers(d.users)).catch(() => {});
    api("/admin/videos").then((d) => setVideos(d.videos)).catch(() => {});
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function toggleDisabled(u) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body: { disabled: !u.disabled } });
      load();
    } catch (e) { alert(e.message); }
  }

  async function removeVideo(id) {
    if (!confirm("Delete this video?")) return;
    try {
      await api(`/admin/videos/${id}`, { method: "DELETE" });
      load();
    } catch (e) { alert(e.message); }
  }

  if (err) return <div className="empty"><h2>{err}</h2></div>;

  const pages = Object.entries(presence.byPage).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...pages.map((p) => p[1]));

  return (
    <div className="admin">
      <h1 className="page-title">🛠 Admin</h1>

      <div className="stat-cards">
        <div className="stat-card live"><span>{presence.online}</span><small>● Online now</small></div>
        <div className="stat-card"><span>{presence.loggedIn}</span><small>Logged-in online</small></div>
        <div className="stat-card"><span>{presence.guests}</span><small>Guests online</small></div>
        <div className="stat-card"><span>{stats?.users ?? "–"}</span><small>Registered users</small></div>
        <div className="stat-card"><span>{stats?.videos ?? "–"}</span><small>Videos</small></div>
        <div className="stat-card"><span>{stats?.subscriptions ?? "–"}</span><small>Subscriptions</small></div>
        <div className="stat-card"><span>{stats?.payments ?? "–"}</span><small>Payments</small></div>
        <div className="stat-card"><span>{stats ? fmtMoney(stats.volume) : "–"}</span><small>Demo volume</small></div>
      </div>

      <div className="admin-grid">
        <section className="admin-panel">
          <h3>Where people are right now</h3>
          {pages.length === 0 && <p className="muted small">Nobody online.</p>}
          {pages.map(([page, n]) => (
            <div className="bar-row" key={page}>
              <span className="bar-label">{page}</span>
              <span className="bar"><i style={{ width: `${(n / max) * 100}%` }} /></span>
              <span>{n}</span>
            </div>
          ))}
        </section>
        <section className="admin-panel">
          <h3>Live visitors</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Page</th><th>Session</th></tr></thead>
              <tbody>
                {presence.sessions.map((s) => (
                  <tr key={s.id}><td>{s.user === "guest" ? "Guest" : "@" + s.user}</td><td>{s.page}</td><td className="muted">{s.id}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <h3>Users</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>@{u.username}</td><td>{u.role}</td>
                  <td>{timeAgo(u.createdAt)}</td>
                  <td>{u.disabled ? "Disabled" : "Active"}</td>
                  <td><button className="pill" onClick={() => toggleDisabled(u)}>{u.disabled ? "Enable" : "Disable"}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <h3>Videos</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Title</th><th>Owner</th><th>Views</th><th>Uploaded</th><th /></tr></thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id}>
                  <td>{v.title}</td><td>@{v.owner.username}</td><td>{v.views}</td><td>{timeAgo(v.createdAt)}</td>
                  <td><button className="pill danger" onClick={() => removeVideo(v.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <AppsAdmin />
    </div>
  );
}
