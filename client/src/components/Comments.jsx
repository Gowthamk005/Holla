import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { timeAgo } from "../lib/format.js";
import Avatar from "./Avatar.jsx";

/* Comments under a video. ownerId lets the video owner delete any comment on their video. */
export default function Comments({ videoId, ownerId }) {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id, text }
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
    if (!confirm("Delete this comment?")) return;
    try {
      await api(`/comments/${c.id}`, { method: "DELETE" });
      setList((prev) => prev.filter((x) => x.id !== c.id));
      setTotal((n) => Math.max(0, n - 1));
    } catch (e) {
      setErr(e.message);
    }
  }

  const canManage = (c) =>
    user && (user.id === c.user.id || user.id === ownerId || user.role === "admin");

  return (
    <section className="comments">
      <h3 className="comments-title">{total} {total === 1 ? "comment" : "comments"}</h3>

      {user ? (
        <form className="comment-form" onSubmit={post}>
          <Avatar user={user} size="sm" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
          />
          <button className="subscribe-btn" disabled={busy || !text.trim()}>
            {busy ? "…" : "Comment"}
          </button>
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
              <span className="muted small">
                {timeAgo(c.createdAt)}{c.editedAt ? " · edited" : ""}
              </span>
            </div>

            {editing?.id === c.id ? (
              <div className="comment-edit">
                <input value={editing.text} maxLength={500}
                  onChange={(e) => setEditing({ ...editing, text: e.target.value })} />
                <div className="row">
                  <button className="pill" onClick={saveEdit}>Save</button>
                  <button className="pill" onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="comment-text">{c.text}</div>
            )}

            {canManage(c) && editing?.id !== c.id && (
              <div className="comment-actions">
                {user.id === c.user.id && (
                  <button className="link" onClick={() => setEditing({ id: c.id, text: c.text })}>Edit</button>
                )}
                <button className="link danger" onClick={() => remove(c)}>Delete</button>
              </div>
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
    </section>
  );
}