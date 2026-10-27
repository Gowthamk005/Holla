/* Throw an error with an HTTP status. The error handler turns it into { error: message }. */
export function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}
