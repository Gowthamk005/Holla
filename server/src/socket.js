import { Server } from "socket.io";
import cookie from "cookie";
import { config } from "./config.js";
import { userFromToken } from "./middleware/auth.js";
import { setIO, userRoom, emitToUser } from "./utils/realtime.js";
import { isId } from "./utils/ids.js";
import { markOnline, markOffline, isOnline } from "./utils/presence.js";
import { Friendship } from "./models/Friendship.js";
import { User } from "./models/User.js";

/*
 * Realtime:
 * - each logged-in socket joins room "user:<id>" (messages, unread counts, friend updates, status)
 * - "typing" is relayed to the other person
 * - online / last seen: friends get "user:status" when someone comes online or goes offline
 * - admins join room "admins" and receive "presence" every 2 seconds
 */
async function notifyFriends(userId, payload) {
  const rels = await Friendship.find({
    status: "accepted",
    $or: [{ requester: userId }, { recipient: userId }],
  }).lean();
  for (const r of rels) {
    const other = String(r.requester) === String(userId) ? r.recipient : r.requester;
    emitToUser(other, "user:status", payload);
  }
}

export function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin, credentials: true },
  });
  setIO(io);

  const sockets = new Map(); // socket.id -> { user, page, since }

  io.use(async (socket, next) => {
    const token = cookie.parse(socket.handshake.headers.cookie || "")[config.cookieName];
    socket.data.user = await userFromToken(token);
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    sockets.set(socket.id, { user, page: "/", since: Date.now() });

    if (user) {
      socket.join(userRoom(user._id));
      if (markOnline(user._id)) {
        notifyFriends(user._id, { userId: String(user._id), online: true, lastSeenAt: null }).catch(() => {});
      }
    }

    socket.on("page", (path) => {
      const entry = sockets.get(socket.id);
      if (entry && typeof path === "string") entry.page = path.slice(0, 80);
    });

    socket.on("typing", (payload = {}) => {
      if (!user || !isId(payload.to)) return;
      emitToUser(payload.to, "typing", { from: String(user._id) });
    });

    socket.on("admin:join", () => {
      if (user?.role === "admin") socket.join("admins");
    });
    socket.on("admin:leave", () => socket.leave("admins"));

    socket.on("disconnect", () => {
      sockets.delete(socket.id);
      if (user && markOffline(user._id)) {
        const now = new Date();
        User.updateOne({ _id: user._id }, { lastSeenAt: now }).catch(() => {});
        notifyFriends(user._id, { userId: String(user._id), online: false, lastSeenAt: now }).catch(() => {});
      }
    });
  });

  function snapshot() {
    const entries = [...sockets.entries()];
    const loggedIn = new Set();
    const byPage = {};
    let guests = 0;
    for (const [, s] of entries) {
      if (s.user) loggedIn.add(String(s.user._id));
      else guests++;
      byPage[s.page] = (byPage[s.page] || 0) + 1;
    }
    return {
      online: entries.length,
      loggedIn: loggedIn.size,
      guests,
      byPage,
      sessions: entries.slice(0, 200).map(([id, s]) => ({
        id: id.slice(0, 6),
        user: s.user ? s.user.username : "guest",
        page: s.page,
        since: s.since,
      })),
    };
  }

  setInterval(() => {
    if (io.sockets.adapter.rooms.get("admins")?.size) io.to("admins").emit("presence", snapshot());
  }, 2000);

  return io;
}

export { isOnline };
