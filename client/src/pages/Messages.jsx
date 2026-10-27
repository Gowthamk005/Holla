import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { getSocket } from "../lib/socket.js";
import { fmtBytes, lastSeenText } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import CameraCapture from "../components/CameraCapture.jsx";
import MessageBubble from "../components/MessageBubble.jsx";

const EDIT_MINUTES = 15;
const LIMIT_MB = { image: 16, video: 100, audio: 25, file: 25 };

const kindOf = (file) =>
  file.type.startsWith("image/") ? "image"
  : file.type.startsWith("video/") ? "video"
  : file.type.startsWith("audio/") ? "audio"
  : "file";

const addOnce = (list, m) => (list.some((x) => x.id === m.id) ? list : [...list, m]);

/* WhatsApp-style chat: "+" attach menu, emoji, camera, select + delete, edit, online and last seen */
export default function Messages() {
  const { userId } = useParams();
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [active, setActive] = useState(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [menuFor, setMenuFor] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [attach, setAttach] = useState("closed"); // closed | open | closing (for the animation)
  const [camera, setCamera] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const bottomRef = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const inputRef = useRef(null);
  const photoRef = useRef(null);
  const docRef = useRef(null);

  const selectMode = selected.length > 0;

  const loadThreads = () => api("/messages/threads").then((d) => setThreads(d.threads)).catch(() => {});

  useEffect(() => { loadThreads(); }, [user?.id]);

  useEffect(() => {
    setEditing(null);
    setPendingFile(null);
    setMenuFor(null);
    setSelected([]);
    setAttach("closed");
    if (!userId) return setActive(null);
    setActive(null);
    api(`/messages/${userId}`)
      .then((d) => {
        setActive(d);
        api(`/messages/${userId}/read`, { method: "POST" }).then(loadThreads).catch(() => {});
      })
      .catch((e) => setActive({ error: e.message }));
  }, [userId]);

  useEffect(() => {
    const s = getSocket();
    const onNew = ({ message }) => {
      loadThreads();
      setActive((a) => {
        if (!a || a.error) return a;
        const other = message.from === user.id ? message.to : message.from;
        return other === a.user.id ? { ...a, messages: addOnce(a.messages, message) } : a;
      });
    };
    const onUpdate = ({ message }) => {
      setActive((a) => (a && !a.error
        ? { ...a, messages: a.messages.map((m) => (m.id === message.id ? message : m)) }
        : a));
    };
    const onStatus = ({ userId: uid, online, lastSeenAt }) => {
      setActive((a) => (a && !a.error && a.user.id === uid ? { ...a, user: { ...a.user, online, lastSeenAt } } : a));
      loadThreads();
    };
    const onTyping = ({ from }) => {
      if (userId && from === userId) {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 2500);
      }
    };
    s.on("message:new", onNew);
    s.on("message:update", onUpdate);
    s.on("user:status", onStatus);
    s.on("typing", onTyping);
    return () => {
      s.off("message:new", onNew);
      s.off("message:update", onUpdate);
      s.off("user:status", onStatus);
      s.off("typing", onTyping);
    };
  }, [userId, user?.id]);

  useEffect(() => {
    if (!selectMode) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length, typing]);

  /* ---- "+" menu with open / close animation ---- */
  function openAttach() { setShowEmoji(false); setAttach("open"); }
  function closeAttach() {
    if (attach !== "open") return;
    setAttach("closing");
    setTimeout(() => setAttach((a) => (a === "closing" ? "closed" : a)), 200);
  }
  function toggleAttach() { attach === "open" ? closeAttach() : openAttach(); }

  /* ---- typing + emoji ---- */
  function onType(value) {
    setText(value);
    const now = Date.now();
    if (userId && !editing && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      getSocket().emit("typing", { to: userId });
    }
  }

  function insertEmoji(emoji) {
    const el = inputRef.current;
    const pos = el?.selectionStart ?? text.length;
    setText(text.slice(0, pos) + emoji + text.slice(pos));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + emoji.length, pos + emoji.length);
    });
  }

  /* ---- sending ---- */
  function chooseFile(file) {
    if (!file) return;
    const k = kindOf(file);
    if (file.size > LIMIT_MB[k] * 1024 * 1024) return alert(`${k} files can be up to ${LIMIT_MB[k]} MB.`);
    setPendingFile(file);
    setAttach("closed");
  }

  async function sendFile(file, caption) {
    setSending(true);
    const fd = new FormData();
    fd.append("file", file);
    if (caption) fd.append("text", caption);
    try {
      const r = await api(`/messages/${userId}/attachment`, { method: "POST", form: fd });
      setActive((a) => (a && !a.error ? { ...a, messages: addOnce(a.messages, r.message) } : a));
      setPendingFile(null);
      setText("");
      loadThreads();
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(newText) {
    if (!newText) return alert("Message cannot be empty.");
    try {
      const r = await api(`/messages/item/${editing}`, { method: "PATCH", body: { text: newText } });
      setActive((a) => (a && !a.error ? { ...a, messages: a.messages.map((m) => (m.id === r.message.id ? r.message : m)) } : a));
      setEditing(null);
      setText("");
    } catch (err) {
      alert(err.message);
    }
  }

  async function send(e) {
    e.preventDefault();
    if (sending) return;
    const t = text.trim();
    if (editing) return saveEdit(t);
    if (pendingFile) return sendFile(pendingFile, t);
    if (!t) return;
    setText("");
    try {
      const r = await api(`/messages/${userId}`, { method: "POST", body: { text: t } });
      setActive((a) => (a && !a.error ? { ...a, messages: addOnce(a.messages, r.message) } : a));
      loadThreads();
    } catch (err) {
      alert(err.message);
      setText(t);
    }
  }

  /* ---- edit one message ---- */
  function startEdit(m) {
    setMenuFor(null);
    setEditing(m.id);
    setPendingFile(null);
    setText(m.text);
    inputRef.current?.focus();
  }
  function cancelEdit() { setEditing(null); setText(""); }

  const canEdit = (m) =>
    m.from === user.id && !m.deletedAt && !m.attachment &&
    Date.now() - new Date(m.createdAt).getTime() < EDIT_MINUTES * 60 * 1000;

  /* ---- selection ---- */
  const mine = (id) => active?.messages?.find((m) => m.id === id)?.from === user.id;
  const selectable = (m) => !m.deletedAt;

  function toggleSelect(id) {
    setMenuFor(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }
  function clearSelection() { setSelected([]); }

  /* "Delete for everyone" is only allowed if every selected message is yours */
  const canDeleteEveryone = selected.length > 0 && selected.every((id) => mine(id));

  async function deleteSelected(mode) {
    setDeleting(true);
    try {
      const r = await api("/messages/actions/delete", { method: "POST", body: { ids: selected, mode } });
      if (mode === "me") {
        setActive((a) => (a && !a.error ? { ...a, messages: a.messages.filter((m) => !selected.includes(m.id)) } : a));
      } else {
        setActive((a) => (a && !a.error
          ? { ...a, messages: a.messages.map((m) => r.messages.find((x) => x.id === m.id) || m) }
          : a));
      }
      setSelected([]);
      setDeleteOpen(false);
      loadThreads();
    } catch (err) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  }

  /* ---- ⋯ menu for one of your own messages ---- */
  const menuButton = (m) => (
    <div className="msg-actions">
      <button
        className="msg-dots"
        aria-label="Message options"
        onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === m.id ? null : m.id); }}
      >⋯</button>
      {menuFor === m.id && (
        <div className="msg-menu">
          {canEdit(m) && <button onClick={() => startEdit(m)}>✎ Edit</button>}
          <button onClick={() => { setMenuFor(null); setSelected([m.id]); }}>☑ Select</button>
        </div>
      )}
    </div>
  );

  const ATTACH_ITEMS = [
    { label: "Photo or video", icon: "🖼", run: () => photoRef.current.click() },
    { label: "Document", icon: "📄", run: () => docRef.current.click() },
    { label: "Camera", icon: "📷", run: () => setCamera(true) },
  ];

  return (
    <div className="chat-shell">
      <aside className="chat-list">
        <h2 className="chat-list-title">Messages</h2>
        {threads.length === 0 && <p className="muted small pad">No conversations yet. Open a friend's profile and press Message.</p>}
        {threads.map((t) => (
          <Link key={t.user.id} to={`/messages/${t.user.id}`} className={`convo ${t.user.id === userId ? "active" : ""} ${t.unread ? "unread" : ""}`}>
            <Avatar user={t.user} size="sm" online={t.user.online} />
            <div className="convo-text">
              <div className="convo-name">{t.user.name}</div>
              <div className="convo-preview">{t.last ? (t.last.from === user.id ? "You: " : "") + t.last.preview : "Say hi 👋"}</div>
            </div>
            {t.unread > 0 && <span className="badge">{t.unread}</span>}
          </Link>
        ))}
      </aside>

      <section className="chat-pane">
        {!userId && <div className="chat-empty"><div className="big">💬</div><h2>Your messages</h2><p className="muted">Pick a conversation on the left.</p></div>}
        {userId && active?.error && <div className="chat-empty"><h2>{active.error}</h2></div>}
        {userId && !active && <div className="chat-empty muted">Loading…</div>}

        {userId && active && !active.error && (
          <>
            {selectMode ? (
              <div className="select-bar slide-down">
                <button className="icon-plain" onClick={clearSelection} aria-label="Cancel selection">✕</button>
                <span className="grow"><b>{selected.length}</b> selected</span>
                <button className="icon-plain danger" onClick={() => setDeleteOpen(true)} aria-label="Delete selected" title="Delete">🗑</button>
              </div>
            ) : (
              <div className="chat-head">
                <Avatar user={active.user} size="sm" online={active.user.online} />
                <div className="grow">
                  <Link to={`/c/${active.user.username}`} className="channel-name">{active.user.name}</Link>
                  <div className="muted small">
                    {typing ? "typing…" : lastSeenText(active.user.online, active.user.lastSeenAt)}
                  </div>
                </div>
              </div>
            )}

            <div className="chat-messages">
              {active.messages.length === 0 && <div className="msg-system">No messages yet. Say hi 👋</div>}
              {active.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  mine={m.from === user.id}
                  actions={m.from === user.id && !m.deletedAt && !selectMode ? menuButton(m) : null}
                  selected={selected.includes(m.id)}
                  selectMode={selectMode}
                  onPress={() => selectable(m) && toggleSelect(m.id)}
                  onTap={() => selectable(m) && toggleSelect(m.id)}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {!selectMode && (
              <div className="composer">
                {editing && (
                  <div className="composer-bar slide-down">
                    <span>✎ Editing message</span>
                    <button className="link" onClick={cancelEdit}>Cancel</button>
                  </div>
                )}
                {pendingFile && !editing && (
                  <div className="composer-bar slide-down">
                    <span>📎 {pendingFile.name} · {fmtBytes(pendingFile.size)}</span>
                    <button className="link" onClick={() => setPendingFile(null)}>Remove</button>
                  </div>
                )}

                {attach !== "closed" && (
                  <div className={`attach-menu ${attach}`}>
                    {ATTACH_ITEMS.map((item, i) => (
                      <button
                        key={item.label}
                        className="attach-item"
                        style={{ "--i": i }}
                        onClick={() => { setAttach("closed"); item.run(); }}
                      >
                        <span className="attach-icon-circle">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showEmoji && <EmojiPicker onPick={insertEmoji} />}

                <form className="chat-input" onSubmit={send}>
                  <button
                    type="button"
                    className={`plus-btn${attach !== "closed" ? " open" : ""}`}
                    title="Attach"
                    aria-label="Attach"
                    onClick={toggleAttach}
                  >+</button>
                  <button type="button" className="icon-plain" title="Emoji" onClick={() => { setShowEmoji((s) => !s); setAttach("closed"); }}>😊</button>
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => onType(e.target.value)}
                    placeholder={pendingFile ? "Add a caption…" : "Message…"}
                    maxLength={2000}
                    autoComplete="off"
                  />
                  <button className="send-btn" disabled={sending || (!editing && !pendingFile && !text.trim())}>
                    {editing ? "Save" : sending ? "…" : "Send"}
                  </button>
                </form>

                <input type="file" hidden ref={photoRef} accept="image/*,video/*"
                  onChange={(e) => { chooseFile(e.target.files[0]); e.target.value = ""; }} />
                <input type="file" hidden ref={docRef}
                  accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                  onChange={(e) => { chooseFile(e.target.files[0]); e.target.value = ""; }} />
              </div>
            )}
          </>
        )}
      </section>

      {deleteOpen && (
        <div className="sheet-backdrop" onClick={() => !deleting && setDeleteOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {selected.length} message{selected.length > 1 ? "s" : ""}?</h3>
            <button className="sheet-btn" disabled={deleting} onClick={() => deleteSelected("me")}>
              Delete for me
              <small>Removes them only from your chat.</small>
            </button>
            <button className="sheet-btn danger" disabled={deleting || !canDeleteEveryone} onClick={() => deleteSelected("everyone")}>
              Delete for everyone
              <small>{canDeleteEveryone ? "Removes them for both people." : "Only available when all selected messages are yours."}</small>
            </button>
            <button className="sheet-btn cancel" disabled={deleting} onClick={() => setDeleteOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {camera && (
        <CameraCapture
          onCapture={(file) => { setCamera(false); setPendingFile(file); }}
          onClose={() => setCamera(false)}
        />
      )}
    </div>
  );
}
