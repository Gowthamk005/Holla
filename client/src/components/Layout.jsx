import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { disconnectSocket, getSocket } from "../lib/socket.js";
import { CATEGORIES } from "../lib/constants.js";
import { useAppTime } from "../hooks/useAppTime.js";
import { getTheme, toggleTheme } from "../lib/theme.js";
import Avatar from "./Avatar.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState(getTheme);

  useAppTime(!!user);

  // tell the server which page this visitor is on (admin dashboard)
  useEffect(() => {
    getSocket().emit("page", location.pathname);
  }, [location.pathname]);

  // reconnect the socket when the logged-in user changes
  useEffect(() => {
    disconnectSocket();
    const s = getSocket();
    const onUnread = (d) => setUnread(d.count);
    s.on("messages:unread", onUnread);
    return () => s.off("messages:unread", onUnread);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    api("/messages/unread").then((d) => setUnread(d.count)).catch(() => {});
  }, [user?.id]);

  // close the account menu whenever the page changes
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);

  function search(e) {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  }

  async function doLogout() {
    setMenu(false);
    await logout();
    navigate("/");
  }

  function switchTheme() {
    setTheme(toggleTheme());
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
          {user ? (
            <button className="avatar-btn" onClick={() => setMenu((m) => !m)} aria-label="Account menu">
              <Avatar user={user} size="sm" />
            </button>
          ) : (
            <Link to={loginLink} className="login-btn">Login</Link>
          )}
        </div>
      </header>

      {menu && user && (
        <>
          <div className="menu-scrim" onClick={() => setMenu(false)} />
          <div className="acct-menu" role="menu">
            <div className="acct-head">
              <Avatar user={user} size="sm" />
              <div>
                <b>{user.name}</b>
                <small>@{user.username}</small>
              </div>
            </div>
            <Link to="/me">👤 Your profile</Link>
            <Link to={`/c/${user.username}`}>📺 Your channel</Link>
            <Link to="/history">🕘 Watch history</Link>
            <Link to="/settings">⚙️ Settings</Link>
            <Link to="/studio">🎬 Studio</Link>
            <Link to="/wallet">💳 Olla Pay</Link>
            {user.role === "admin" && <Link to="/admin">🛠 Admin</Link>}
            <div className="acct-sep" />
            <button className="acct-theme" onClick={switchTheme}>
              <span>{theme === "light" ? "🌙 Dark mode" : "☀️ Light mode"}</span>
            </button>
            <button className="acct-danger" onClick={doLogout}>⎋ Log out</button>
          </div>
        </>
      )}

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
        <NavLink to="/wallet" className="nav-item">💳 Olla Pay</NavLink>
        {user && <NavLink to="/create" className="nav-item">＋ Create</NavLink>}
        <div className="sidebar-title">Categories</div>
        {CATEGORIES.map((c) => (
          <NavLink key={c.key} to={`/category/${c.key}`} className="nav-item">{c.icon} {c.label}</NavLink>
        ))}
        {user?.role === "admin" && <NavLink to="/admin" className="nav-item">🛠 Admin</NavLink>}
      </aside>

      <main className="main">
        <Outlet />
      </main>

      {/* bottom bar: Home, Shorts, Create (+), Chat, You */}
      <nav className="mobile-nav">
        <NavLink to="/" end><span>⌂</span>Home</NavLink>
        <NavLink to="/shorts"><span>📱</span>Shorts</NavLink>
        <NavLink to={user ? "/create" : loginLink}><span className="plus-nav">＋</span>Create</NavLink>
        <NavLink to="/messages">
          <span>💬</span>Chat
          {unread > 0 && <b className="badge">{unread > 9 ? "9+" : unread}</b>}
        </NavLink>
        <NavLink to={user ? "/me" : loginLink}><span>👤</span>{user ? "You" : "Login"}</NavLink>
      </nav>
    </div>
  );
}
