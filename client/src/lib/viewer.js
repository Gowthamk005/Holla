const KEY = "holla_viewer";

export function getViewerId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(KEY, id);
    }
    return id.slice(0, 80);
  } catch {
    return "anon";
  }
}