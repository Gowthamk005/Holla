import { useState } from "react";
import { getTheme, toggleTheme } from "../lib/theme.js";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getTheme);
  const isLight = theme === "light";
  return (
    <button
      type="button"
      className="theme-btn"
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      onClick={() => setTheme(toggleTheme())}
    >
      {isLight ? "🌙" : "☀️"}
    </button>
  );
}