import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { timeAgo } from "../lib/format.js";
import Avatar from "./Avatar.jsx";

/*
 * Comments under a video or short.
 * Rules (checked on the server too):
 * - Anyone logged in can comment.
 * - Only the author can EDIT their comment.
 * - Only the author (or an admin) can DELETE a comment.
 * The ⋯ button opens a menu overlay with the actions that are allowed.
 */
export default function Comments({ videoId }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }
  const [sheet, setSheet] = useState(null);     // comment whose ⋯ menu is open
  const [err, setErr] = useState("");

  async function load(before) {
    try {
      const d = await api(`/comments/video/${videoId}?limit=20${before ? `&before=${encodeURIComponent(before)}` : ""}`);
      setList((prev) => (before ? [...prev, ...d.comments] : d.comments));
      setTotal(d.total);
      setHasMore(d.hasMore);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => {
    setList([]);
    load();
  }, [videoId]);

  const canEdit = (c) => !!user && user.id === c.user.id;
  const canDelete = (c) => !!user && (user.id === c.user.id || user.role === "admin");

  async function post(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api(`/comments/video/${videoId}`, { method: "POST", body: { text: t } });
      setList((prev) => [r.comment, ...prev]);
      setTotal((n) => n + 1);
      setText("");
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing?.text.trim()) return;
    try {
      const r = await api(`/comments/${editing.id}`, { method: "PATCH", body: { text: editing.text } });
      setList((prev) => prev.map((c) => (c.id === r.comment.id ? r.comment : c)));
      setEditing(null);
    } catch (e) {
      setErr(e.message);
    }
  }

  async function remove(c) {
    setSheet(null);
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/comments/${c.id}`, { method: "DELETE" });
      setList((prev) => prev.filter((x) => x.id !== c.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      setErr(e.message);
    }
  }

  function startEdit(c) {
    setSheet(null);
    setEditing({ id: c.id, text: c.text });
  }

  return (
    <section className="comments">
      <h3 className="comments-title">{total} {total === 1 ? "comment" : "comments"}</h3>

      {user ? (
        <form className="comment-form" onSubmit={post}>
          <Avatar user={user} size="sm" />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" maxLength={500} />
          <button className="subscribe-btn" disabled={busy || !text.trim()}>{busy ? "…" : "Comment"}</button>
        </form>
      ) : (
        <p className="muted small">
          <Link to={`/login?next=${encodeURIComponent(window.location.pathname)}`} className="channel-name">Log in</Link> to comment.
        </p>
      )}

      {err && <p className="error">{err}</p>}

      {list.map((c) => (
        <div key={c.id} className="comment-row">
          <Link to={`/c/${c.user.username}`}>
            <Avatar channel={c.user} size="sm" />
          </Link>
          <div className="grow">
            <div className="comment-head">
              <Link to={`/c/${c.user.username}`} className="comment-name">{c.user.name}</Link>
              <span className="muted small">{timeAgo(c.createdAt)}{c.editedAt ? " · edited" : ""}</span>
              {(canEdit(c) || canDelete(c)) && editing?.id !== c.id && (
                <button className="cmt-more" onClick={() => setSheet(c)} aria-label="Comment options">⋯</button>
              )}
            </div>

            {editing?.id === c.id ? (
              <div className="comment-edit">
                <input
                  value={editing.text}
                  maxLength={500}
                  autoFocus
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                />
                <div className="row">
                  <button className="pill" onClick={saveEdit}>Save</button>
                  <button className="pill" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="comment-text">{c.text}</div>
            )}
          </div>
        </div>
      ))}

      {hasMore && (
        <button className="pill comments-more" onClick={() => load(list[list.length - 1].createdAt)}>
          Show more comments
        </button>
      )}
      {total === 0 && <p className="muted small">Be the first to comment.</p>}

      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="muted small" style={{ margin: 0 }}>Comment by {sheet.user.name}</p>
            {canEdit(sheet) && (
              <button className="sheet-btn" onClick={() => startEdit(sheet)}>
                ✎ Edit comment
                <small>Change the text. It will show as edited.</small>
              </button>
            )}
            {canDelete(sheet) && (
              <button className="sheet-btn danger" onClick={() => remove(sheet)}>
                🗑 Delete comment
                <small>This cannot be undone.</small>
              </button>
            )}
            <button className="sheet-btn cancel" onClick={() => setSheet(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
