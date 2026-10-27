import { useEffect, useRef, useState } from "react";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const QUALITIES = [1080, 720, 480, 360, 240, 144];

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export default function VideoPlayer({ video }) {
  const wrapRef = useRef(null);
  const vRef = useRef(null);
  const pending = useRef(null);   // keeps the time and play state when quality changes
  const hideTimer = useRef(null);
  const panelRef = useRef(null);

  const [src, setSrc] = useState(video.videoUrl);
  const [quality, setQuality] = useState("original");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [panel, setPanel] = useState(null); // null | "main" | "quality" | "speed"
  const [isFull, setIsFull] = useState(false);

  // "original" plus 144p to 1080p. A size is "ready" only if the server made that copy.
  const made = new Map((video.renditions || []).map((r) => [r.height, r]));
  const options = [
    { key: "original", label: "Original", url: video.videoUrl, ready: true },
    ...QUALITIES.map((h) => ({ key: h, label: `${h}p`, url: made.get(h)?.url, ready: made.has(h) })),
  ];
  const current = options.find((o) => o.key === quality);

  useEffect(() => { if (vRef.current) vRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => { if (vRef.current) vRef.current.loop = loop; }, [loop]);
  useEffect(() => { if (vRef.current) vRef.current.muted = muted; }, [muted]);
  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    panelRef.current = panel;
    if (panel) setShowUi(true);
  }, [panel]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  // controls hide after 2.5 seconds of no movement while playing
  function poke() {
    setShowUi(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      const v = vRef.current;
      if (v && !v.paused && !panelRef.current) setShowUi(false);
    }, 2500);
  }

  function togglePlay() {
    const v = vRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else wrapRef.current?.requestFullscreen?.();
  }

  async function togglePip() {
    const v = vRef.current;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      alert("Picture-in-picture is not supported in this browser.");
    }
    setPanel(null);
  }

  function stepSpeed(dir) {
    const i = SPEEDS.indexOf(speed);
    const base = i < 0 ? SPEEDS.indexOf(1) : i;
    setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, base + dir))]);
  }

  function changeQuality(opt) {
    if (!opt.ready) return;
    if (opt.key !== quality) {
      const v = vRef.current;
      pending.current = { time: v.currentTime, play: !v.paused };
      setQuality(opt.key);
      setSrc(opt.url);
    }
    setPanel(null);
  }

  // runs when a new file (after a quality change) is ready
  function onLoaded() {
    const v = vRef.current;
    setDuration(v.duration || 0);
    v.playbackRate = speed;
    v.loop = loop;
    v.muted = muted;
    if (pending.current) {
      v.currentTime = pending.current.time;
      if (pending.current.play) v.play().catch(() => {});
      pending.current = null;
    }
  }

  // keyboard: Space/K play, ←/→ 5 seconds, M mute, F fullscreen, P Picture-in-picture, </> speed
  function onKey(e) {
    const v = vRef.current;
    if (!v) return;
    const actions = {
      " ": togglePlay,
      k: togglePlay,
      ArrowRight: () => { v.currentTime = Math.min(v.duration || 0, v.currentTime + 5); },
      ArrowLeft: () => { v.currentTime = Math.max(0, v.currentTime - 5); },
      m: () => setMuted((x) => !x),
      f: toggleFull,
      p: togglePip,
      ">": () => stepSpeed(1),
      "<": () => stepSpeed(-1),
    };
    const fn = actions[e.key];
    if (fn) {
      e.preventDefault();
      fn();
      poke();
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`vp${showUi ? "" : " vp-hide"}${isFull ? " vp-full" : ""}`}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseDown={() => wrapRef.current?.focus()}
      onMouseMove={poke}
      onTouchStart={poke}
      onMouseLeave={() => { if (vRef.current && !vRef.current.paused) setShowUi(false); }}
    >
      <video
        ref={vRef}
        src={src}
        poster={video.thumbnailUrl || undefined}
        playsInline
        autoPlay
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={() => setTime(vRef.current.currentTime)}
        onLoadedMetadata={onLoaded}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />
      {buffering && <div className="vp-spinner" aria-label="Loading" />}

      {panel && (
        <div className="vp-panel" onClick={(e) => e.stopPropagation()}>
          {panel === "main" && (
            <>
              <button onClick={() => setPanel("quality")}>
                <span>Quality</span><span className="vp-val">{current?.label} ›</span>
              </button>
              <button onClick={() => setPanel("speed")}>
                <span>Playback speed</span><span className="vp-val">{speed === 1 ? "Normal" : `${speed}x`} ›</span>
              </button>
              <button onClick={() => setLoop((l) => !l)}>
                <span>Loop</span><span className="vp-val">{loop ? "On" : "Off"}</span>
              </button>
              <button onClick={togglePip}>
                <span>Picture-in-picture</span><span className="vp-val">⧉</span>
              </button>
            </>
          )}

          {panel === "quality" && (
            <>
              <button className="vp-back" onClick={() => setPanel("main")}>‹ Quality</button>
              {options.map((o) => (
                <button key={o.key} disabled={!o.ready} onClick={() => changeQuality(o)}>
                  <span>{o.key === quality ? "✓ " : ""}{o.label}</span>
                  {!o.ready && <span className="vp-val">not ready</span>}
                </button>
              ))}
            </>
          )}

          {panel === "speed" && (
            <>
              <button className="vp-back" onClick={() => setPanel("main")}>‹ Playback speed</button>
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => { setSpeed(s); setPanel(null); }}>
                  <span>{s === speed ? "✓ " : ""}{s === 1 ? "Normal" : `${s}x`}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      <div className="vp-bar" onClick={(e) => e.stopPropagation()}>
        <input
          type="range"
          className="vp-seek"
          min={0}
          max={duration || 0}
          step="0.1"
          value={time}
          aria-label="Seek"
          onChange={(e) => {
            const t = Number(e.target.value);
            vRef.current.currentTime = t;
            setTime(t);
          }}
        />
        <div className="vp-row">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <span className="vp-time">{fmt(time)} / {fmt(duration)}</span>
          <span className="grow" />
          <button onClick={() => setMuted((m) => !m)} aria-label="Mute">{muted ? "🔇" : "🔊"}</button>
          <button onClick={() => setPanel((p) => (p ? null : "main"))} aria-label="Settings">⚙</button>
          <button onClick={toggleFull} aria-label="Fullscreen">{isFull ? "⤡" : "⛶"}</button>
        </div>
      </div>
    </div>
  );
}