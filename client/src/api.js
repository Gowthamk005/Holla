import { getViewerId } from "./lib/viewer.js";

export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, credentials: "include", headers: { "X-Viewer": getViewerId() } };
  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch("/api" + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}