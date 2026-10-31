import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { localDay } from "./useAppTime.js";

/*
 * - Counts ONE view after 3 seconds of real playback (the server also counts each viewer once).
 *   Replaying or reopening the video does not add another view.
 * - Saves watch history: when paused, every 15 seconds, and when the page is closed.
 * - Adds watch time to the user's time dashboard.
 */
export function useWatchTracking(vRef, videoId, playing) {
  const { user } = useAuth();
  const seconds = useRef(0);
  const counted = useRef(false);

  const saveProgress = (pos) => {
    if (!user || !videoId || !(pos > 0)) return;
    api(`/videos/${videoId}/progress`, { method: "POST", body: { position: pos } }).catch(() => {});
  };

  useEffect(() => {
    seconds.current = 0;
    counted.current = false;
  }, [videoId]);

  // save the position when the video is paused
  useEffect(() => {
    if (!playing && vRef.current) saveProgress(vRef.current.currentTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // save the position when the browser tab or app is closed
  useEffect(() => {
    const onHide = () => {
      if (vRef.current) saveProgress(vRef.current.currentTime);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, user?.id]);

  // runs while the video plays
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const v = vRef.current;
      if (!v || v.paused) return;
      seconds.current += 1;

      if (!counted.current && seconds.current >= 3) {
        counted.current = true;
        api(`/videos/${videoId}/view`, { method: "POST" }).catch(() => {});
      }

      if (user && seconds.current % 15 === 0) {
        saveProgress(v.currentTime);
        api("/me/activity", { method: "POST", body: { watch: 15, day: localDay() } }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, videoId, user?.id]);
}
