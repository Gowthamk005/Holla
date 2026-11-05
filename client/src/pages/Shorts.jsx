import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import VideoPlayer from "../components/VideoPlayer.jsx";
import Avatar from "../components/Avatar.jsx";
import Comments from "../components/Comments.jsx";
import { fmtCount } from "../lib/format.js";
import ShareButton from "../components/ShareButton.jsx";

/* Vertical (9:16) Shorts viewer. Swipe or scroll up and down; only the visible short plays. */
export default function Shorts() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [active, setActive] = useState(id || null);
  const [details, setDetails] = useState({}); // id -> { video, viewer }
  const [commentsFor, setCommentsFor] = useState(null);
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);

  // load the shorts; if the chosen one is not in the first batch, add it at the top
  useEffect(() => {
    api("/videos?format=short&limit=50")
      .then(async (d) => {
        let videos = d.videos;
        if (id && !videos.some((v) => v.id === id)) {
          const one = await api(`/videos/${id}`).then((r) => r.video).catch(() => null);
          if (one && one.format === "short") videos = [one, ...videos];
          else if (one) return navigate(`/watch/${id}`, { replace: true });
        }
        setList(videos);
      })
      .catch((e) => setErr(e.message));
  }, []);

  // open the chosen short
  useEffect(() => {
    if (!list || !id) return;
    document.getElementById("short-" + id)?.scrollIntoView({ block: "start" });
  }, [list]);

  // the short that fills most of the screen becomes the active one
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !list) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const vid = e.target.dataset.id;
            setActive(vid);
            navigate(`/shorts/${vid}`, { replace: true });
          }
        });
      },
      { root, threshold: [0.6] }
    );
    root.querySelectorAll(".short-slide").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [list]);

  // load likes and viewer state for the active short
  useEffect(() => {
    if (!active || details[active]) return;
    api(`/videos/${active}`).then((d) => setDetails((m) => ({ ...m, [active]: d }))).catch(() => {});
  }, [active]);

  async function toggleLike(v) {
    if (!user) return navigate(`/login?next=/shorts/${v.id}`);
    const cur = details[v.id];
    if (!cur) return;
    try {
      const r = await api(`/videos/${v.id}/interact`, {
        method: "POST",
        body: { type: "like", on: !cur.viewer.liked },
      });
      setDetails((m) => ({
        ...m,
        [v.id]: {
          video: { ...cur.video, likesCount: r.likesCount },
          viewer: { ...cur.viewer, liked: r.liked },
        },
      }));
    } catch (e) {
      alert(e.message);
    }
  }

  if (err) return <div className="empty"><h2>{err}</h2></div>;
  if (!list) return <p className="muted">Loading shorts…</p>;
  if (!list.length) {
    return (
      <div className="empty">
        <h2>No shorts yet</h2>
        <p>Tap + at the bottom and choose Short to upload a vertical video.</p>
      </div>
    );
  }

  return (
    <div className="shorts-page">
      <div className="shorts-scroll" ref={scrollRef}>
        {list.map((v) => {
          const d = details[v.id];
          const liked = d?.viewer?.liked;
          const likes = d?.video?.likesCount ?? v.likesCount ?? 0;
          return (
            <section key={v.id} id={"short-" + v.id} data-id={v.id} className="short-slide">
              <div className="short-frame">
                {active === v.id ? (
                  <VideoPlayer key={v.id} video={v} />
                ) : (
                  <img className="short-poster" src={v.thumbnailUrl || ""} alt="" />
                )}
              </div>

              <div className="short-info">
                <Link to={`/c/${v.owner.username}`} className="short-channel">
                  <Avatar channel={v.owner} size="sm" />
                  <b>@{v.owner.username}</b>
                </Link>
                <div className="short-title">{v.title}</div>
              </div>

              <div className="short-side">
                <button className={liked ? "side-btn on" : "side-btn"} onClick={() => toggleLike(v)} aria-label="Like">
                  <span>👍</span>
                  <small>{fmtCount(likes)}</small>
                </button>
                <button className="side-btn" onClick={() => setCommentsFor(v)} aria-label="Comments">
                  <span>💬</span>
                  <small>{fmtCount(v.commentsCount || 0)}</small>
                </button>
                <ShareButton url={`${window.location.origin}/shorts/${v.id}`} title={v.title} className="side-btn">
                  <span>↗</span>
                  <small>Share</small>
                </ShareButton>
              </div>
            </section>
          );
        })}
      </div>

      {commentsFor && (
        <div className="sheet-backdrop" onClick={() => setCommentsFor(null)}>
          <div className="sheet comments-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Comments</b>
              <button className="icon-plain" onClick={() => setCommentsFor(null)} aria-label="Close">✕</button>
            </div>
            <div className="sheet-scroll">
              <Comments videoId={commentsFor.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
