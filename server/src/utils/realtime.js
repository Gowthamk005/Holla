/* Lets route files send realtime events without importing the socket server directly. */
let io = null;

export const setIO = (server) => {
  io = server;
};

export const userRoom = (id) => `user:${String(id)}`;

export function emitToUser(userId, event, data) {
  if (io) io.to(userRoom(userId)).emit(event, data);
}
