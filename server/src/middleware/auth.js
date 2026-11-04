import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models/User.js";

const COOKIE_AGE = 7 * 24 * 60 * 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, config.jwtSecret, { expiresIn: "7d" });
}

export function setAuthCookie(res, token) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    maxAge: COOKIE_AGE,
    path: "/",
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProd,
    path: "/",
  });
}

/* returns the user for a token, or null (bad token, deleted or disabled user) */
export async function userFromToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(sub);
    return user && !user.disabled ? user : null;
  } catch {
    return null;
  }
}

export async function optionalAuth(req, res, next) {
  req.user = await userFromToken(req.cookies?.[config.cookieName]);
  next();
}

export async function requireAuth(req, res, next) {
  req.user = await userFromToken(req.cookies?.[config.cookieName]);
  if (!req.user) return res.status(401).json({ error: "Please login first." });
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admins only." });
  next();
}
