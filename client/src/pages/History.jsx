import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmtDuration, timeAgo } from "../lib/format.js";

/* Your own watch history, grouped by day, like YouTube's History page */
function dayLabel(ts) {
  const d = new Date(ts);
  const now = new Date();
  const yest = new Date(now.getTime() - 86400000);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function History() {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api("/history").then((d) => setItems(d.items)).catch((e) => setErr(e.message));
  }, []);

  async function removeOne(videoId) {
    try {
      await api(`/history/${videoId}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.video.id !== videoId));
    } catch (e) {
      alert(e.message);
    }
  }

  async function clearAll() {
    if (!confirm("Clear all your watch history? This cannot be undone.")) return;
    try {
      await api("/history", { method: "DELETE" });
      setItems([]);
    } catch (e) {
      alert(e.message);
    }
  }

  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const shown = (items || []).filter(
      (i) => !q || i.video.title.toLowerCase().includes(q) || i.video.owner.name.toLowerCase().includes(q)
    );
    const map = new Map();
    for (const i of shown) {
      const label = dayLabel(i.updatedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(i);
    }
    return [...map.entries()];
  }, [items, filter]);

  if (err) return <p className="error">{err}</p>;
  if (!items) return <p className="muted">Loading your history…</p>;

  return (
    <div className="history-page">
      <div className="hist-tools">
        <h1 className="page-title" style={{ margin: 0 }}>🕘 Watch history</h1>
        <input
          className="hist-search"
          type="search"
          placeholder="Search watch history"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {items.length > 0 && <button className="pill danger" onClick={clearAll}>Clear all history</button>}
      </div>

      {items.length === 0 && (
        <div className="empty">
          <h2>No watch history yet</h2>
          <p>Videos and Shorts you watch will appear here.</p>
        </div>
      )}

      {groups.map(([label, rows]) => (
        <section key={label} className="hist-group">
          <h3 className="hist-group-title">{label}</h3>
          {rows.map((i) => {
            const v = i.video;
            const isShort = v.format === "short";
            const pct = v.duration ? Math.min(100, (i.position / v.duration) * 100) : 0;
            const to = isShort ? `/shorts/${v.id}` : `/watch/${v.id}`;
            return (
              <div key={v.id} className="hist-row">
                <Link to={to} className={isShort ? "hist-thumb short" : "hist-thumb"}>
                  {v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" /> : <div className="thumb-empty">▶</div>}
                  <div className="hist-bar"><i style={{ width: `${pct}%` }} /></div>
                </Link>
                <div className="grow">
                  <Link to={to} className="hist-title">{v.title}</Link>
                  <div className="muted small">{v.owner.name} · {isShort ? "Short" : "Video"}</div>
                  <div className="muted small">
                    Stopped at {fmtDuration(i.position)} · {timeAgo(i.updatedAt)}
                  </div>
                </div>
                <button className="hist-remove" onClick={() => removeOne(v.id)} aria-label="Remove from history" title="Remove">✕</button>
              </div>
            );
          })}
        </section>
      ))}

      {items.length > 0 && groups.length === 0 && <p className="muted">Nothing matches your search.</p>}
    </div>
  );
}
