import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { applyTheme, getTheme } from "./lib/theme.js";
import "./styles/app.css";
import "./styles/fixes.css";
import "../src/components/ErrorBoundary.jsx";

// apply the saved dark / light theme before the first page is drawn
applyTheme(getTheme());

// reload when the browser restores an old page from its back-button memory
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
