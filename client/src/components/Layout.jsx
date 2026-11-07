import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { disconnectSocket, getSocket } from "../lib/socket.js";
import { CATEGORIES } from "../lib/constants.js";
import { useAppTime } from "../hooks/useAppTime.js";
import { alertsOn, systemAlert } from "../lib/notify.js";
import ChatToast from "./ChatToast.jsx";

export default function Layout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const pathRef = useRef(location.pathname);

  useAppTime(!!user);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  // opening the chat with that friend clears its popup
  useEffect(() => {
    setToast((t) => (t && location.pathname === `/messages/${t.sender.id}` ? null : t));
  }, [location.pathname]);

  // tell the server which page this visitor is on (admin dashboard)
  useEffect(() => {
    getSocket().emit("page", location.pathname);
  }, [location.pathname]);

  // reconnect the socket when the logged-in user changes
  useEffect(() => {
    disconnectSocket();
    const s = getSocket();
    const onUnread = (d) => setUnread(d.count);
    // a friend sent a chat message: show the popup, and a system alert when the tab is in the background
    const onChat = (d) => {
      if (!alertsOn()) return;
      if (pathRef.current === `/messages/${d.sender.id}`) return;
      setToast(d);
      const text = d.message.text || (d.message.attachment ? "📎 Sent you a file" : "Sent you a message");
      systemAlert(d.sender.name, text, () => navigate(`/messages/${d.sender.id}`));
    };
    s.on("messages:unread", onUnread);
    s.on("chat:notify", onChat);
    return () => {
      s.off("messages:unread", onUnread);
      s.off("chat:notify", onChat);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api("/messages/unread").then((d) => setUnread(d.count)).catch(() => {});
  }, [user?.id]);

  const closeToast = useCallback(() => setToast(null), []);

  function search(e) {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  }

  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">Holl<span>A.</span></Link>

        <form className="search" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search videos" />
          <button type="submit" aria-label="Search">🔍</button>
        </form>

        <div className="header-right">
          {user && (
            <Link to="/messages" className="icon-btn" title="Messages">
              💬{unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          )}
          {!user && <Link to={loginLink} className="login-btn">Login</Link>}
        </div>
      </header>

      <ChatToast alert={toast} onClose={closeToast} />

      <aside className="sidebar">
        <NavLink to="/" end className="nav-item">⌂ Home</NavLink>
        <NavLink to="/shorts" className="nav-item">📱 Shorts</NavLink>
        <NavLink to="/trending" className="nav-item">🔥 Trending</NavLink>
        <NavLink to="/subscriptions" className="nav-item">▣ Subscriptions</NavLink>
        <NavLink to="/messages" className="nav-item">💬 Messages</NavLink>
        <NavLink to="/people" className="nav-item">👥 People</NavLink>
        <NavLink to="/youtube" className="nav-item">▶ YouTube</NavLink>
        <NavLink to="/apps" className="nav-item">🧩 Apps</NavLink>
        <NavLink to="/history" className="nav-item">🕘 History</NavLink>
        <NavLink to="/library/like" className="nav-item">♡ Liked videos</NavLink>
        <NavLink to="/library/save" className="nav-item">◷ Watch later</NavLink>
        <NavLink to="/playlists" className="nav-item">🎵 Playlists</NavLink>
        <NavLink to="/wallet" className="nav-item">💳 Olla Pay</NavLink>
        {user && <NavLink to="/me" className="nav-item">👤 My profile</NavLink>}
        {user && <NavLink to="/create" className="nav-item sidebar-create">＋ Create</NavLink>}
        <div className="sidebar-title">Categories</div>
        {CATEGORIES.map((c) => (
          <NavLink key={c.key} to={`/category/${c.key}`} className="nav-item">{c.icon} {c.label}</NavLink>
        ))}
        {user?.role === "admin" && <NavLink to="/admin" className="nav-item">🛠 Admin</NavLink>}
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {/* bottom bar: Home, Shorts, + (icon only), Chat, People, You (your profile) */}
      <nav className="mobile-nav">
        <NavLink to="/" end><span>⌂</span>Home</NavLink>
        <NavLink to="/shorts"><span>📱</span>Shorts</NavLink>
        <NavLink to={user ? "/create" : loginLink} aria-label="Create" title="Create">
          <span className="plus-nav">＋</span>
        </NavLink>
        <NavLink to="/messages">
          <span>💬</span>Chat
          {unread > 0 && <b className="badge">{unread > 9 ? "9+" : unread}</b>}
        </NavLink>
        <NavLink to={user ? "/people" : loginLink}><span>👥</span>People</NavLink>
        <NavLink to={user ? "/me" : loginLink}><span>👤</span>{user ? "You" : "Login"}</NavLink>
      </nav>
    </div>
  );
}
