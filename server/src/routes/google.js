import { Router } from "express";
import crypto from "crypto";
import { config } from "../config.js";
import { User } from "../models/User.js";
import { setAuthCookie, signToken } from "../middleware/auth.js";
import { baseUsername, safeNext } from "../utils/oauth.js";

/*
 * Google sign-in (OAuth 2.0 authorization code flow).
 * 1. /api/auth/google          -> redirect to Google's consent page (with a random "state")
 * 2. /api/auth/google/callback -> Google sends the user back with a code;
 *                                  we check "state", exchange the code for a token on the server,
 *                                  read the profile, log the user in, and redirect to the app.
 * The client secret is only used here on the server.
 */
const router = Router();

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const ROUTE_PATH = "/api/auth/google";
const enabled = () => !!(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
const shortCookie = { httpOnly: true, sameSite: "lax", secure: config.isProd, maxAge: 10 * 60 * 1000, path: ROUTE_PATH };

/* GET /api/auth/providers -> { google: true|false } so the app knows whether to show the button */
router.get("/providers", (req, res) => {
  res.json({ google: enabled() });
});

router.get("/google", (req, res) => {
  if (!enabled()) return res.redirect(`${config.clientOrigin}/login?error=google-off`);

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("olla_oauth_state", state, shortCookie);
  res.cookie("olla_oauth_next", safeNext(req.query.next), shortCookie);

  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`${AUTH_URL}?${params}`);
});

router.get("/google/callback", async (req, res) => {
  const fail = (reason) => res.redirect(`${config.clientOrigin}/login?error=${reason}`);
  const expectedState = req.cookies?.olla_oauth_state;
  const next = safeNext(req.cookies?.olla_oauth_next);
  res.clearCookie("olla_oauth_state", { path: ROUTE_PATH });
  res.clearCookie("olla_oauth_next", { path: ROUTE_PATH });

  const { code, state, error } = req.query;
  if (error || !code || !expectedState || state !== expectedState) return fail("google");

  try {
    // exchange the code for an access token (server to server)
    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(8000),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) throw new Error("token exchange failed");

    // read the profile
    const infoRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    const info = await infoRes.json();
    if (!infoRes.ok || !info.sub || !info.email) throw new Error("profile missing");
    if (!info.email_verified) return fail("google-unverified");

    const user = await findOrCreateGoogleUser(info);
    if (user.disabled) return fail("disabled");

    setAuthCookie(res, signToken(user));
    res.redirect(`${config.clientOrigin}${next}`);
  } catch (err) {
    console.error("Google login failed:", err.message);
    fail("google");
  }
});

async function findOrCreateGoogleUser(info) {
  const email = info.email.toLowerCase();

  let user = await User.findOne({ googleId: info.sub });
  if (!user) user = await User.findOne({ email }); // same verified email: link the account
  if (user) {
    if (!user.googleId) user.googleId = info.sub;
    if (!user.email) user.email = email;
    if (!user.avatarUrl && info.picture) user.avatarUrl = info.picture;
    await user.save();
    return user;
  }

  let username = baseUsername(email);
  for (let i = 0; i < 10 && (await User.exists({ username })); i++) {
    username = username.slice(0, 15) + crypto.randomInt(1000, 9999);
  }
  if (await User.exists({ username })) username = "olla" + crypto.randomBytes(4).toString("hex");

  return User.create({
    username,
    name: (info.name || email.split("@")[0]).slice(0, 40),
    email,
    googleId: info.sub,
    avatarUrl: info.picture || "",
    role: config.adminUsernames.includes(username) ? "admin" : "user",
  });
}

export default router;
