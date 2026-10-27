import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { disconnectSocket, getSocket } from "../lib/socket.js";
import { CATEGORIES } from "../lib/constants.js";
import Avatar from "./Avatar.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);

  /* tell the server which page this visitor is on (admin dashboard) */
  useEffect(() => {
    getSocket().emit("page", location.pathname);
  }, [location.pathname]);

  /* reconnect the socket whenever the logged-in user changes, so the server knows who we are */
  useEffect(() => {
    disconnectSocket();
    const s = getSocket();
    const onUnread = (d) => setUnread(d.count);
    s.on("messages:unread", onUnread);
    return () => s.off("messages:unread", onUnread);
  }, [user?.id]);

  useEffect(() => {
    if (!user) return setUnread(0);
    api("/messages/unread").then((d) => setUnread(d.count)).catch(() => {});
  }, [user?.id]);

  function search(e) {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  }

  async function doLogout() {
    setMenu(false);
    await logout();
    navigate("/");
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
          <Link to={user ? "/studio" : loginLink} className="upload-btn">＋ Create</Link>
          {user && (
            <Link to="/messages" className="icon-btn" title="Messages">
              💬{unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          )}
          {user ? (
            <div className="user-wrap">
              <button className="user-btn" onClick={() => setMenu((m) => !m)} aria-label="Account">
                <Avatar user={user} size="sm" />
              </button>
              {menu && (
                <div className="user-menu" onMouseLeave={() => setMenu(false)}>
                  <div className="user-menu-head">
                    <Avatar user={user} size="sm" />
                    <div><b>{user.name}</b><small>@{user.username}</small></div>
                  </div>
                  <Link to={`/c/${user.username}`} onClick={() => setMenu(false)}>Your channel</Link>
                  <Link to="/studio" onClick={() => setMenu(false)}>Studio</Link>
                  <Link to="/wallet" onClick={() => setMenu(false)}>Holla Pay</Link>
                  {user.role === "admin" && <Link to="/admin" onClick={() => setMenu(false)}>Admin</Link>}
                  <button onClick={doLogout}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to={loginLink} className="login-btn">Login</Link>
          )}
        </div>
      </header>

      <aside className="sidebar">
        <NavLink to="/" end className="nav-item">⌂ Home</NavLink>
        <NavLink to="/trending" className="nav-item">🔥 Trending</NavLink>
        <NavLink to="/subscriptions" className="nav-item">▣ Subscriptions</NavLink>
        <NavLink to="/messages" className="nav-item">💬 Messages</NavLink>
        <NavLink to="/people" className="nav-item">👥 People</NavLink>
        <NavLink to="/youtube" className="nav-item">▶ YouTube</NavLink>
        <NavLink to="/apps" className="nav-item">📱 Apps</NavLink>
        <NavLink to="/library/like" className="nav-item">♡ Liked videos</NavLink>
        <NavLink to="/library/save" className="nav-item">◷ Watch later</NavLink>
        <NavLink to="/wallet" className="nav-item">💳 Holla Pay</NavLink>
        <div className="sidebar-title">Categories</div>
        {CATEGORIES.map((c) => (
          <NavLink key={c.key} to={`/category/${c.key}`} className="nav-item">{c.icon} {c.label}</NavLink>
        ))}
        {user?.role === "admin" && <NavLink to="/admin" className="nav-item">🛠 Admin</NavLink>}
      </aside>

      <main className="main"><Outlet /></main>

      <nav className="mobile-nav">
        <NavLink to="/" end><span>⌂</span>Home</NavLink>
        <NavLink to="/trending"><span>🔥</span>Trending</NavLink>
        <NavLink to={user ? "/studio" : loginLink}><span>＋</span>Create</NavLink>
        <NavLink to="/messages"><span>💬</span>Chat{unread > 0 && <b className="badge">{unread > 9 ? "9+" : unread}</b>}</NavLink>
        <NavLink to={user ? `/c/${user.username}` : loginLink}><span>👤</span>{user ? "You" : "Login"}</NavLink>
      </nav>
    </div>
  );
}
