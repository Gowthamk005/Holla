import { useEffect } from "react";
import { api } from "../api.js";

export const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* adds 30 seconds every 30 seconds while the tab is open and visible */
export function useAppTime(enabled) {
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        api("/me/activity", { method: "POST", body: { app: 30, day: localDay() } }).catch(() => {});
      }
    }, 30000);
    return () => clearInterval(id);
  }, [enabled]);
}