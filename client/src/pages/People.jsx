import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";

export default function People() {
  const [suggest, setSuggest] = useState(null);
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] });

  function load() {
    api("/people/suggestions").then((d) => setSuggest(d.people)).catch(() => setSuggest([]));
    api("/friends").then(setFriends).catch(() => {});
  }
  useEffect(load, []);

  async function act(path, body) {
    try {
      await api(path, { method: "POST", body });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">👥 People</h1>

      {friends.incoming.length > 0 && (
        <section>
          <h3 className="section-title">Friend requests</h3>
          {friends.incoming.map((u) => (
            <div className="row-card" key={u.id}>
              <Avatar user={u} size="sm" />
              <div className="grow"><b>{u.name}</b><div className="muted small">@{u.username}</div></div>
              <button className="subscribe-btn" onClick={() => act("/friends/respond", { userId: u.id, accept: true })}>Accept</button>
              <button className="pill" onClick={() => act("/friends/respond", { userId: u.id, accept: false })}>Decline</button>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="section-title">People you may know</h3>
        {suggest === null && <p className="muted">Loading…</p>}
        {suggest?.length === 0 && <p className="muted">No suggestions yet. Subscribe to creators or pick interests to get better matches.</p>}
        <div className="people-grid">
          {suggest?.map(({ user: u, reasons }) => (
            <div className="person-card" key={u.id}>
              <Avatar user={u} size="lg" />
              <div className="person-name">{u.name}</div>
              <div className="muted small">@{u.username}</div>
              <div className="reasons">{reasons.map((r) => <div key={r}>{r}</div>)}</div>
              <div className="person-actions">
                <button className="subscribe-btn" onClick={() => act("/friends/request", { userId: u.id })}>Add friend</button>
                <Link to={`/c/${u.username}`} className="pill">View</Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="section-title">Your friends ({friends.friends.length})</h3>
        <div className="people-grid">
          {friends.friends.map((u) => (
            <div className="person-card" key={u.id}>
              <Avatar user={u} size="lg" />
              <div className="person-name">{u.name}</div>
              <div className="muted small">@{u.username}</div>
              <div className="person-actions">
                <Link to={`/messages/${u.id}`} className="subscribe-btn">Message</Link>
                <Link to={`/c/${u.username}`} className="pill">Profile</Link>
              </div>
            </div>
          ))}
        </div>
        {friends.friends.length === 0 && <p className="muted">No friends yet.</p>}
      </section>
    </div>
  );
}
