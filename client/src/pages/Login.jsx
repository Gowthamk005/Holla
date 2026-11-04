import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../../api.js";

const OAUTH_ERRORS = {
  google: "Google sign-in failed. Please try again.",
  "google-off": "Google sign-in is not set up on the server yet.",
  "google-unverified": "Your Google email is not verified.",
  disabled: "This account has been disabled.",
};

export default function Login({ mode = "login" }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const [form, setForm] = useState({ name: "", username: "", password: "", password2: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isRegister = mode === "register";
  const [googleOn, setGoogleOn] = useState(false);
  const oauthError = OAUTH_ERRORS[params.get("error")] || "";

  useEffect(() => {
    api("/auth/providers").then((p) => setGoogleOn(!!p.google)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (isRegister && form.password !== form.password2) return setErr("Passwords do not match.");
    setBusy(true);
    try {
      const payload = isRegister
        ? { name: form.name, username: form.username, password: form.password }
        : { username: form.username, password: form.password };
      await login(payload, isRegister ? "register" : "login");
      window.location.replace(next);
        } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" className="logo">Holl<span>A.</span></Link>
        <h2>{isRegister ? "Create your account" : "Login to Holla"}</h2>
        {googleOn && (
          <>
            <a className="google-btn" href={`/api/auth/google?next=${encodeURIComponent(next)}`}>
              <span className="g-logo">G</span> Continue with Google
            </a>
            <div className="or">or</div>
          </>
        )}
        {isRegister && (
          <input placeholder="Display name" maxLength={40} value={form.name} onChange={set("name")} required autoComplete="name" />
        )}
        <input placeholder="Username" maxLength={20} value={form.username} onChange={set("username")} required autoCapitalize="none" autoComplete="username" />
        <input type="password" placeholder="Password" value={form.password} onChange={set("password")} required autoComplete={isRegister ? "new-password" : "current-password"} />
        {isRegister && (
          <input type="password" placeholder="Confirm password" value={form.password2} onChange={set("password2")} required autoComplete="new-password" />
        )}
        {(err || oauthError) && <p className="error">{err || oauthError}</p>}
        <button className="subscribe-btn wide" disabled={busy}>{busy ? "Please wait…" : isRegister ? "Create account" : "Login"}</button>
        <p className="muted small">
          {isRegister ? "Already have an account? " : "New to Holla? "}
          <Link to={isRegister ? `/login?next=${encodeURIComponent(next)}` : `/register?next=${encodeURIComponent(next)}`}>
            {isRegister ? "Login" : "Create an account"}
          </Link>
        </p>
      </form>
    </div>
  );
}
