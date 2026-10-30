import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../api.js";
import { localDay } from "./useAppTime.js";

/*
 * - Counts a view after 3 seconds of real playback (the server counts each viewer once).
 * - Every 15 seconds (logged in): saves where you stopped and adds watch time.
 */
export function useWatchTracking(vRef, videoId, playing) {
  const { user } = useAuth();
  const seconds = useRef(0);
  const counted = useRef(false);

  useEffect(() => {
    seconds.current = 0;
    counted.current = false;
  }, [videoId]);

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
        api(`/videos/${videoId}/progress`, { method: "POST", body: { position: v.currentTime } }).catch(() => {});
        api("/me/activity", { method: "POST", body: { watch: 15, day: localDay() } }).catch(() => {});
      }
    }, 1000);
    return () => clearInterval(id);
  }, [playing, videoId, user?.id]);
}