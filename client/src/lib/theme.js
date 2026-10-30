const KEY = "holla_theme";

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  setTimeout(() => root.classList.remove("theme-switching"), 350);
  try {
    localStorage.setItem(KEY, theme);
  } catch {}
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#f5f6f8" : "#0f0f0f");
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(next);
  return next;
}