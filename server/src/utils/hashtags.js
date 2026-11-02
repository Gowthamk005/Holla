/* Finds #hashtags in text. Works with letters from any language, numbers and underscores. */
const RE = /#([\p{L}\p{M}\p{N}_]{1,50})/gu;

export function extractHashtags(text = "") {
  const found = new Set();
  for (const m of String(text).matchAll(RE)) {
    found.add(m[1].toLowerCase());
    if (found.size >= 15) break;
  }
  return [...found];
}
