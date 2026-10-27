import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === "production";

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must be set (32+ characters) when NODE_ENV=production");
}

export const CATEGORIES = [
  "movies", "music", "gaming", "comedy", "education",
  "travel", "food", "motivation", "news",
];

export const config = {
  isProd,
  port: parseInt(process.env.PORT || "5000", 10),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/olla",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  adminUsernames: (process.env.ADMIN_USERNAMES || "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  maxVideoBytes: parseInt(process.env.MAX_VIDEO_MB || "500", 10) * 1024 * 1024,
  uploadsDir: path.resolve(here, "../uploads"),
  clientDist: path.resolve(here, "../../client/dist"),
  cookieName: "olla_token",
  demoStartBalance: 100000, // Rs 1,000.00 in paise (play money)
  youtubeApiKey: process.env.YOUTUBE_API_KEY || "",
  youtubeRegion: process.env.YOUTUBE_REGION || "IN",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:5173/api/auth/google/callback",
};
