/* Counts open connections per user. A user is "online" while at least one tab is connected. */
const counts = new Map();

/* returns true if this was the user's first connection */
export function markOnline(userId) {
  const k = String(userId);
  const n = (counts.get(k) || 0) + 1;
  counts.set(k, n);
  return n === 1;
}

/* returns true if this was the user's last connection */
export function markOffline(userId) {
  const k = String(userId);
  const n = (counts.get(k) || 0) - 1;
  if (n <= 0) {
    counts.delete(k);
    return true;
  }
  counts.set(k, n);
  return false;
}

export const isOnline = (userId) => counts.has(String(userId));
