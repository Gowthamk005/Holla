import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";
import { config } from "../config.js";
import { fail } from "../utils/errors.js";
import { selfUser } from "../utils/serialize.js";
import { clearAuthCookie, requireAuth, setAuthCookie, signToken } from "../middleware/auth.js";

const router = Router();

/* slows down password guessing: 30 attempts per 15 minutes per IP */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

router.post("/register", authLimiter, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!name || name.length > 40) fail(400, "Enter a display name (up to 40 characters).");
  if (!/^[a-z0-9_.]{3,20}$/.test(username)) fail(400, "Username: 3-20 letters, numbers, dot or underscore.");
  if (password.length < 8 || password.length > 200) fail(400, "Password must be 8 to 200 characters.");

  let user;
  try {
    user = await User.create({
      name,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role: config.adminUsernames.includes(username) ? "admin" : "user",
    });
  } catch (err) {
    if (err.code === 11000) fail(409, "That username is already taken.");
    throw err;
  }

  setAuthCookie(res, signToken(user));
  res.status(201).json({ user: selfUser(user) });
});

router.post("/login", authLimiter, async (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const user = await User.findOne({ username }).select("+passwordHash");
  // Google-only accounts have no password, so they cannot use this form
  const ok = !!user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) fail(401, "Wrong username or password.");
  if (user.disabled) fail(403, "This account has been disabled.");

  if (config.adminUsernames.includes(user.username) && user.role !== "admin") {
    user.role = "admin";
    await user.save();
  }

  setAuthCookie(res, signToken(user));
  res.json({ user: selfUser(user) });
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: selfUser(req.user) });
});

export default router;
