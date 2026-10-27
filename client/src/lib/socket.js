import { io } from "socket.io-client";

/* One shared connection per tab. The server reads the login cookie on connect. */
let socket = null;

export function getSocket() {
  if (!socket) socket = io({ withCredentials: true });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
