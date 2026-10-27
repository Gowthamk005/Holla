/* Pure helpers (no imports) so they can be tested offline. */

/* Only allow redirects inside this site, e.g. "/watch/abc". Blocks "//evil.com" and other tricks. */
export function safeNext(value) {
  const s = String(value || "/");
  return s.startsWith("/") && !s.startsWith("//") && !s.includes("\\") && s.length < 300 ? s : "/";
}

/* "ravi.kumar@gmail.com" -> "ravi.kumar" (allowed characters only, 3 to 16 long) */
export function baseUsername(email = "") {
  const local = String(email).split("@")[0].toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 16);
  return local.length >= 3 ? local : ("olla_" + local).slice(0, 16);
}
