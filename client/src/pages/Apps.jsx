import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import AppCard from "../components/AppCard.jsx";

const SECTIONS = [
  { key: "food", title: "🍔 Foods" },
  { key: "travel", title: "✈️ Travel" },
  { key: "movies", title: "🎬 Movies & tickets" },
  { key: "shopping", title: "🛍️ Shopping" },
  { key: "other", title: "📦 Other apps" },
];

const RECENT_KEY = "holla_recent_apps";
const MAX_RECENT = 8;

function readRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
}

function writeRecent(ids) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
  } catch {
    /* storage full or blocked: ignore */
  }
}

export default function Apps() {
  const [apps, setApps] = useState(null);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [recentIds, setRecentIds] = useState(readRecent);

  useEffect(() => {
    api("/apps").then((d) => setApps(d.apps)).catch((e) => setErr(e.message));
  }, []);

  const q = query.trim().toLowerCase();

  // apps the user opened recently, newest first
  const recent = useMemo(
    () =>
      (apps || [])
        .filter((a) => recentIds.includes(a.id))
        .sort((x, y) => recentIds.indexOf(x.id) - recentIds.indexOf(y.id)),
    [apps, recentIds]
  );

  function onOpen(app) {
    const next = [app.id, ...recentIds.filter((id) => id !== app.id)].slice(0, MAX_RECENT);
    setRecentIds(next);
    writeRecent(next);
  }

  function clearRecent() {
    setRecentIds([]);
    writeRecent([]);
  }

  if (err) return <p className="error">{err}</p>;
  if (!apps) return <p className="muted">Loading…</p>;

  // search matches name, description and category
  const results = apps.filter(
    (a) =>
      !q ||
      [a.name, a.description, a.category].some((v) => String(v || "").toLowerCase().includes(q))
  );

  return (
    <div className="apps-page">
      <div className="apps-head">
        <h1 className="page-title">📱 Apps</h1>
        <input
          className="apps-search"
          type="search"
          placeholder="Search apps (Swiggy, Uber, movies…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {apps.length === 0 && (
        <div className="empty"><h2>No apps yet</h2><p>An admin can add apps from the Admin page.</p></div>
      )}

      {q ? (
        <section className="apps-section">
          <h3 className="section-title">Results for “{query.trim()}” ({results.length})</h3>
          {results.length === 0 ? (
            <p className="muted">No apps match. Try another word.</p>
          ) : (
            <div className="app-grid">
              {results.map((a) => <AppCard key={a.id} app={a} onOpen={onOpen} />)}
            </div>
          )}
        </section>
      ) : (
        <>
          {recent.length > 0 && (
            <section className="apps-section">
              <div className="section-row">
                <h3 className="section-title">🕘 Recently used</h3>
                <button className="link" onClick={clearRecent}>Clear</button>
              </div>
              <div className="app-grid">
                {recent.map((a) => <AppCard key={a.id} app={a} onOpen={onOpen} />)}
              </div>
            </section>
          )}

          {SECTIONS.map((s) => {
            const list = apps.filter((a) => a.category === s.key);
            if (!list.length) return null;
            return (
              <section key={s.key} className="apps-section">
                <h3 className="section-title">{s.title}</h3>
                <div className="app-grid">
                  {list.map((a) => <AppCard key={a.id} app={a} onOpen={onOpen} />)}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}