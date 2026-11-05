import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { connectDB } from "./db.js";
import { createSocketServer } from "./socket.js";
import authRoutes from "./routes/auth.js";
import googleRoutes from "./routes/google.js";
import videoRoutes from "./routes/videos.js";
import channelRoutes from "./routes/channels.js";
import meRoutes from "./routes/me.js";
import friendRoutes from "./routes/friends.js";
import peopleRoutes from "./routes/people.js";
import messageRoutes from "./routes/messages.js";
import walletRoutes from "./routes/wallet.js";
import adminRoutes from "./routes/admin.js";
import youtubeRoutes from "./routes/youtube.js";
import appRoutes from "./routes/apps.js";
import historyRoutes from "./routes/history.js";
import playlistRoutes from "./routes/playlists.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// uploaded videos and thumbnails (range requests work, so the player can seek)
app.use("/uploads", express.static(config.uploadsDir, { dotfiles: "deny", index: false }));

app.use("/api", rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", googleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/videos", videoRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/me", meRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/people", peopleRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/youtube", youtubeRoutes);
app.use("/api/apps", appRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/playlists", playlistRoutes);

app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

// production: serve the built React app from the same server
if (fs.existsSync(path.join(config.clientDist, "index.html"))) {
  app.use(express.static(config.clientDist));
  app.use((req, res, next) => (req.method === "GET" ? res.sendFile(path.join(config.clientDist, "index.html")) : next()));
}

// error handler: every error becomes { error: "..." } with a status code
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "That file is too large." });
  const status = err.status || (err.name === "CastError" ? 400 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 && config.isProd ? "Something went wrong." : err.message });
});

const server = http.createServer(app);
createSocketServer(server);

for (const dir of ["videos", "thumbs", "chat", "apps"]) fs.mkdirSync(path.join(config.uploadsDir, dir), { recursive: true });

await connectDB();
server.listen(config.port, () => {
  console.log(`Olla API running on http://localhost:${config.port}`);
});
