export function fmtCount(n = 0) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + " min ago";
  if (s < 86400) return Math.floor(s / 3600) + " hours ago";
  if (s < 2592000) return Math.floor(s / 86400) + " days ago";
  return new Date(iso).toLocaleDateString();
}

export function fmtDuration(sec = 0) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/* money is always stored as integer paise on the server */
export function fmtMoney(paise = 0) {
  const sign = paise < 0 ? "-" : "";
  return sign + "₹" + (Math.abs(paise) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* "12.50" -> 1250. Returns null if the text is not a valid amount */
export function rupeesToPaise(text) {
  const t = String(text || "").trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const paise = parseInt(whole, 10) * 100 + parseInt((frac + "00").slice(0, 2), 10);
  return paise > 0 ? paise : null;
}

export function fmtBytes(bytes = 0) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(2) + " GB";
}

export function clockTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/* "online", "last seen today at 9:40 PM", "last seen yesterday at …", or the date */
export function lastSeenText(online, iso) {
  if (online) return "online";
  if (!iso) return "offline";
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const time = clockTime(iso);
  if (d.toDateString() === now.toDateString()) return `last seen today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;
  return `last seen ${d.toLocaleDateString()}`;
}
