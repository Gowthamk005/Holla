/* Same rule as the server: #word, any language, numbers and underscores */
export function extractHashtags(text = "") {
  const found = new Set();
  for (const m of String(text).matchAll(/#([\p{L}\p{M}\p{N}_]{1,50})/gu)) {
    found.add(m[1].toLowerCase());
    if (found.size >= 15) break;
  }
  return [...found];
}
