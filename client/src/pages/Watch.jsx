import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { fmtCount, timeAgo } from "../lib/format.js";
import { categoryLabel } from "../lib/constants.js";
import Avatar from "../components/Avatar.jsx";
import SubscribeButton from "../components/SubscribeButton.jsx";
import VideoCard from "../components/VideoCard.jsx";
import VideoPlayer from "../components/VideoPlayer.jsx";
import Comments from "../components/Comments.jsx";
import Description from "../components/Description.jsx";
import ShareButton from "../components/ShareButton.jsx";
import SaveToPlaylist from "../components/SaveToPlaylist.jsx";

/* Normal (16:9) video page. Shorts are sent to the vertical Shorts viewer. */
export default function Watch() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [related, setRelated] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    setErr("");
    setRelated([]);
    // no view is counted here: the player counts a view after 3 seconds of playing
    api(`/videos/${id}`)
      .then((d) => {
        if (d.video.format === "short") {
          navigate(`/shorts/${id}`, { replace: true });
          return;
        }
        setData(d);
        api(`/videos?category=${d.video.category}&limit=12`)
          .then((r) => setRelated(r.videos.filter((v) => v.id !== id)))
          .catch(() => {});
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  async function interact(type) {
    if (!user) return navigate(`/login?next=/watch/${id}`);
    const key = type === "like" ? "liked" : "saved";
    const on = !data.viewer[key];
    try {
      const r = await api(`/videos/${id}/interact`, { method: "POST", body: { type, on } });
      setData((d) => ({
        ...d,
        video: { ...d.video, likesCount: r.likesCount },
        viewer: { ...d.viewer, [key]: on },
      }));
    } catch (e) {
      alert(e.message);
    }
  }

  if (err) return <div className="empty"><h2>{err}</h2><Link to="/">Back to Home</Link></div>;
  if (!data) return <p className="muted">Loading…</p>;

  const { video, viewer } = data;
  const ch = video.owner;
  const isOwner = user && (user.id === ch.id || user.role === "admin");

  return (
    <div className="watch">
      <div className="watch-main">
        <VideoPlayer key={video.id} video={video} />
        <h1 className="watch-title">{video.title}</h1>

        <div className="watch-bar">
          <div className="channel-row">
            <Link to={`/c/${ch.username}`}><Avatar channel={ch} size="md" /></Link>
            <div className="channel-text">
              <Link to={`/c/${ch.username}`} className="channel-name">{ch.name}</Link>
              <div className="muted small">{fmtCount(ch.subscribersCount)} subscribers</div>
            </div>
            <SubscribeButton channel={ch} subscribed={viewer.subscribed} showCount={false} />
          </div>
          <div className="action-row">
            <button className={viewer.liked ? "pill on" : "pill"} onClick={() => interact("like")}>👍 {fmtCount(video.likesCount)}</button>
            <button className={viewer.saved ? "pill on" : "pill"} onClick={() => interact("save")}>{viewer.saved ? "🔖 Saved" : "🔖 Save"}</button>
            <ShareButton url={`${window.location.origin}/watch/${video.id}`} title={video.title} />
            <SaveToPlaylist videoId={video.id} />
            {isOwner && <Link className="pill" to={`/edit/${video.id}`}>✎ Edit</Link>}
          </div>
        </div>

        <div className="description">
          <div className="muted small">
            {fmtCount(video.views)} views · {timeAgo(video.createdAt)} · {categoryLabel(video.category)}
          </div>
          <Description text={video.description} />
          {video.hashtags?.length > 0 && (
            <div className="tag-row">
              {video.hashtags.map((t) => (
                <Link key={t} to={`/tag/${t}`} className="tag-chip">#{t}</Link>
              ))}
            </div>
          )}
        </div>

        <Comments videoId={video.id} />
      </div>

      <aside className="related">
        <h3>Up next</h3>
        {related.length === 0 && <p className="muted small">No more videos in this category yet.</p>}
        {related.map((v) => <VideoCard key={v.id} video={v} compact />)}
      </aside>
    </div>
  );
}
