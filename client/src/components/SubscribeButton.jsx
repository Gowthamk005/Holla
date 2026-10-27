import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { fmtCount } from "../lib/format.js";

/*
 * YouTube-style subscribe button.
 * - Guests are sent to login.
 * - Clicking updates instantly (optimistic) and rolls back if the server refuses.
 * - Hidden behind "Your channel" when you view your own page.
 */
export default function SubscribeButton({ channel, subscribed, showCount = true, onChange }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [on, setOn] = useState(!!subscribed);
  const [count, setCount] = useState(channel.subscribersCount || 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn(!!subscribed), [subscribed]);
  useEffect(() => setCount(channel.subscribersCount || 0), [channel.subscribersCount]);

  if (user && user.id === channel.id) {
    return <span className="muted">Your channel</span>;
  }

  async function toggle() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (busy) return;
    const next = !on;
    setBusy(true);
    setOn(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const r = await api(`/channels/${channel.id}/subscribe`, { method: "POST", body: { on: next } });
      setOn(r.subscribed);
      setCount(r.subscribersCount);
      onChange?.(r);
    } catch (e) {
      setOn(!next);
      setCount((c) => c + (next ? -1 : 1));
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="subscribe-wrap">
      {showCount && <span className="muted">{fmtCount(count)} subscribers</span>}
      <button className={on ? "subscribe-btn subscribed" : "subscribe-btn"} onClick={toggle} disabled={busy}>
        {on ? "Subscribed ✓" : "Subscribe"}
      </button>
    </span>
  );
}
