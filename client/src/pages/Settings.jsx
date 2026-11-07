import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { localDay } from "../hooks/useAppTime.js";
import Avatar from "../components/Avatar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";

const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "ta", label: "தமிழ் (Tamil)" },
  { key: "hi", label: "हिन्दी (Hindi)" },
];
const LANG_KEY = "holla_language";

function savedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY) || "en";
  } catch {
    return "en";
  }
}

const fmtTime = (sec = 0) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};

const MENU = [
  { key: "general", icon: "👤", label: "General" },
  { key: "language", icon: "🌐", label: "Language" },
  { key: "time", icon: "⏱", label: "Time watched" },
];
const TITLES = { general: "General", language: "Language", time: "Time watched" };

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState("menu");
  const [profile, setProfile] = useState({ name: user?.name || "", bio: user?.bio || "" });
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState(null);
  const [lang, setLang] = useState(savedLanguage);

  useEffect(() => {
    if (section === "time") api(`/me/stats?day=${localDay()}`).then(setStats).catch(() => {});
  }, [section]);

  async function saveProfile(e) {
    e.preventDefault();
    try {
      const r = await api("/me", { method: "PATCH", body: profile });
      setUser(r.user);
      setMsg("Saved");
    } catch (err) {
      setMsg(err.message);
    }
  }

  function pickLanguage(key) {
    setLang(key);
    try {
      localStorage.setItem(LANG_KEY, key);
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
  }

  async function doLogout() {
    await logout();
    navigate("/");
  }

  const maxApp = Math.max(60, ...(stats?.days || []).map((d) => d.app));

  return (
    <div className="settings">
      {section === "menu" ? (
        <>
          <h1 className="page-title">⚙ Settings</h1>
          <div className="set-menu">
            {MENU.map((m) => (
              <button key={m.key} className="set-row" onClick={() => setSection(m.key)}>
                <span className="set-icon">{m.icon}</span>
                <b>{m.label}</b>
                <span className="set-arrow">›</span>
              </button>
            ))}
            <button className="set-row set-logout" onClick={doLogout}>
              <span className="set-icon">⎋</span>
              <b>Log Out</b>
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="set-back" onClick={() => setSection("menu")}>‹ Settings</button>
          <h1 className="page-title">{TITLES[section]}</h1>

          {section === "general" && (
            <div className="settings-grid">
              <div className="card-form">
                <h3>Profile picture</h3>
                <div className="row">
                  <Avatar user={user} size="xl" />
                  <button className="pill" onClick={() => navigate("/me")}>Change picture on your profile</button>
                </div>
                <p className="muted small">Your picture also shows in chats.</p>
              </div>

              <form className="card-form" onSubmit={saveProfile}>
                <h3>Account</h3>
                <input placeholder="Display name" maxLength={40} value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
                <textarea rows={3} maxLength={300} placeholder="Bio" value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
                <button className="subscribe-btn">Save</button>
                {msg && <p className="ok-text">{msg}</p>}
              </form>

              <div className="card-form">
                <h3>Appearance</h3>
                <div className="row"><span>Dark or light theme</span><ThemeToggle /></div>
              </div>
            </div>
          )}

          {section === "language" && (
            <div className="set-menu">
              {LANGUAGES.map((l) => (
                <button key={l.key} className={lang === l.key ? "set-row active" : "set-row"} onClick={() => pickLanguage(l.key)}>
                  <b>{l.label}</b>
                  <span className="set-arrow">{lang === l.key ? "✓" : ""}</span>
                </button>
              ))}
              <p className="muted small">
                Your choice is saved on this device. Holla's menus are still in English; full translation is not built yet.
              </p>
            </div>
          )}

          {section === "time" && (
            <div className="time-dashboard">
              <p className="muted small">Time counts while Holla is open and visible in your browser.</p>
              <div className="stat-cards">
                <div className="stat-card"><span>{fmtTime(stats?.today.app)}</span><small>Holla today</small></div>
                <div className="stat-card"><span>{fmtTime(stats?.today.watch)}</span><small>Watching today</small></div>
                <div className="stat-card"><span>{fmtTime(stats?.total.app)}</span><small>Holla all time</small></div>
                <div className="stat-card"><span>{fmtTime(stats?.total.watch)}</span><small>Watching all time</small></div>
              </div>

              <div className="admin-panel">
                <h3>Last 7 days</h3>
                <div className="time-bars">
                  {(stats?.days || []).map((d) => (
                    <div key={d.day} className="time-col">
                      <div className="time-value">{fmtTime(d.app)}</div>
                      <div className="time-track">
                        <div className="time-fill" style={{ height: `${(d.app / maxApp) * 100}%` }} />
                      </div>
                      <div className="muted small">{new Date(d.day + "T00:00:00").toLocaleDateString([], { weekday: "short" })}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
