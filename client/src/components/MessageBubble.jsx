import { useRef, useState } from "react";
import { clockTime, fmtBytes } from "../lib/format.js";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function Attachment({ a }) {
  if (a.type === "image") {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" draggable={false}>
        <img className="att-img" src={a.url} alt={a.name} loading="lazy" />
      </a>
    );
  }
  if (a.type === "video") return <video className="att-video" src={a.url} controls preload="metadata" />;
  if (a.type === "audio") return <audio className="att-audio" src={a.url} controls preload="metadata" />;
  return (
    <a className="att-file" href={a.url} download={a.name} target="_blank" rel="noopener noreferrer">
      <span className="att-icon">📄</span>
      <span className="att-info">
        <b>{a.name}</b>
        <small>{fmtBytes(a.size)} · tap to download</small>
      </span>
    </a>
  );
}

/*
 * One chat message.
 * - Press and hold (about half a second) to start selecting.
 * - While selecting, a tap toggles the message.
 * - `actions` is the ⋯ menu for your own messages.
 * - ☺ opens the reaction picker. `onReact(emoji)` is called when one is chosen.
 */
export default function MessageBubble({ m, mine, actions, selected = false, selectMode = false, onPress, onTap, onReact }) {
  const timer = useRef(null);
  const fired = useRef(false);
  const [picking, setPicking] = useState(false);
  const cls = mine ? "msg mine" : "msg theirs";

  if (m.deletedAt) {
    return (
      <div className={cls}>
        <div className="bubble deleted">🚫 This message was deleted</div>
        <div className="msg-meta">{clockTime(m.createdAt)}</div>
      </div>
    );
  }

  // how many people reacted with each emoji
  const counts = {};
  (m.reactions || []).forEach((r) => {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  });
  const groups = Object.entries(counts);

  const start = (e) => {
    if (e.target.closest?.("button, a, video, audio")) return;
    fired.current = false;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fired.current = true;
      onPress?.();
    }, 450);
  };
  const stop = () => clearTimeout(timer.current);
  const click = (e) => {
    if (e.target.closest?.("button, a, video, audio")) return;
    if (fired.current) {
      fired.current = false;
      return;
    }
    if (selectMode) onTap?.();
  };

  return (
    <div
      className={`${cls}${selected ? " selected" : ""}${selectMode ? " selectable" : ""}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={click}
    >
      <div className="bubble-row">
        {selectMode && <span className={`check${selected ? " on" : ""}`}>{selected ? "✓" : ""}</span>}
        {mine && actions}
        <div className={m.attachment ? "bubble has-att" : "bubble"}>
          {m.attachment && <Attachment a={m.attachment} />}
          {m.text && <div className="bubble-text">{m.text}</div>}
        </div>
        {!selectMode && onReact && (
          <button className="react-btn" onClick={() => setPicking((p) => !p)} aria-label="React to message">☺</button>
        )}
      </div>
      {picking && (
        <div className="react-bar">
          {REACTIONS.map((e) => (
            <button key={e} className="react-opt" onClick={() => { setPicking(false); onReact?.(e); }} aria-label={`React ${e}`}>{e}</button>
          ))}
        </div>
      )}
      {groups.length > 0 && (
        <div className="react-chips">
          {groups.map(([e, n]) => (
            <span key={e} className="react-chip">{e}{n > 1 && <small> {n}</small>}</span>
          ))}
        </div>
      )}
      <div className="msg-meta">
        {clockTime(m.createdAt)}
        {m.editedAt && " · edited"}
        {mine && m.readAt && " · ✓✓ Seen"}
      </div>
    </div>
  );
}
