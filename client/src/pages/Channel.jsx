import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { fmtCount, timeAgo } from "../lib/format.js";
import Avatar from "../components/Avatar.jsx";
import SubscribeButton from "../components/SubscribeButton.jsx";
import VideoCard from "../components/VideoCard.jsx";

/* Creator page: /c/:username. Shows banner, stats, subscribe button, friend + message actions and uploads. */
export default function Channel() {
  const { username } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("videos");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(null);
    setErr("");
    api(`/channels/${username}`).then(setData).catch((e) => setErr(e.message));
  }, [username]);

  if (err) return <div className="empty"><h2>{err}</h2><Link to="/">Back to Home</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;

  const { channel: ch, videos, viewer } = data;
  const isOwner = user?.id === ch.id;

  function onSubscribed(r) {
    setData((d) => ({
      ...d,
      channel: { ...d.channel, subscribersCount: r.subscribersCount },
      viewer: { ...d.viewer, subscribed: r.subscribed },
    }));
  }

  async function friendAction() {
    if (!user) return navigate(`/login?next=/c/${ch.username}`);
    setBusy(true);
    try {
      let status = viewer.friendStatus;
      if (status === "none") {
        await api("/friends/request", { method: "POST", body: { userId: ch.id } });
        status = "pending_out";
      } else if (status === "pending_in") {
        await api("/friends/respond", { method: "POST", body: { userId: ch.id, accept: true } });
        status = "friends";
      }
      setData((d) => ({ ...d, viewer: { ...d.viewer, friendStatus: status } }));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const friendLabel = {
    none: "＋ Add friend",
    pending_out: "Request sent",
    pending_in: "Accept request",
    friends: "Friends ✓",
  }[viewer.friendStatus];

  return (
    <div className="channel">
      <div className="banner" style={ch.bannerUrl ? { backgroundImage: `url(${ch.bannerUrl})` } : undefined} />
      <div className="channel-head">
        <Avatar channel={ch} size="xl" />
        <div className="channel-id">
          <h1>{ch.name}</h1>
          <div className="muted">
            @{ch.username} · {fmtCount(ch.subscribersCount)} subscribers · {videos.length} videos
          </div>
          <p className="bio">{ch.bio || "This creator has not added a bio yet."}</p>
          <div className="channel-actions">
            {isOwner ? (
              <Link to="/studio" className="subscribe-btn">Manage your videos</Link>
            ) : (
              <>
                <SubscribeButton channel={ch} subscribed={viewer.subscribed} showCount={false} onChange={onSubscribed} />
                {user && (
                  <>
                    <button className={viewer.friendStatus === "friends" ? "pill on" : "pill"} disabled={busy || viewer.friendStatus === "pending_out" || viewer.friendStatus === "friends"} onClick={friendAction}>
                      {friendLabel}
                    </button>
                    <Link to={`/messages/${ch.id}`} className="pill">💬 Message</Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "videos" ? "tab active" : "tab"} onClick={() => setTab("videos")}>Videos</button>
        <button className={tab === "about" ? "tab active" : "tab"} onClick={() => setTab("about")}>About</button>
      </div>

      {tab === "videos" && (
        videos.length === 0 ? (
          <div className="empty"><h2>No videos yet</h2>{isOwner && <p>Upload your first video from Studio.</p>}</div>
        ) : (
          <div className="video-grid">{videos.map((v) => <VideoCard key={v.id} video={v} />)}</div>
        )
      )}

      {tab === "about" && (
        <div className="about">
          <p>{ch.bio || "No bio yet."}</p>
          <p className="muted small">Joined {new Date(ch.createdAt).toLocaleDateString()} · Last upload {videos[0] ? timeAgo(videos[0].createdAt) : "never"}</p>
        </div>
      )}
    </div>
  );
}
