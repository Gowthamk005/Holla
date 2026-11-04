/* Chat alerts. The popup shows while Holla is open; a system notification shows when the tab is in the background. */
const KEY = "holla_chat_alerts";

export function alertsOn() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true; // storage blocked: keep alerts on
  }
}

/* turns alerts on or off; turning them on asks the browser for permission (must run from a click) */
export async function setAlerts(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: the setting lasts for this visit only */
  }
  if (on && "Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      /* the browser refused: popups still work */
    }
  }
  return on;
}

/* system notification, only when the tab is hidden and the browser allowed it */
export function systemAlert(title, body, onClick) {
  if (!alertsOn() || !("Notification" in window)) return;
  if (!document.hidden || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag: "holla-chat" });
    n.onclick = () => {
      window.focus();
      if (onClick) onClick();
      n.close();
    };
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}
