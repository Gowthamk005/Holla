import { useEffect, useState } from "react";
import { api } from "../api.js";

const CATEGORIES = [
  ["food", "Foods"], ["travel", "Travel"], ["movies", "Movies & tickets"], ["shopping", "Shopping"], ["other", "Other"],
];
const EMPTY = { id: null, name: "", category: "food", url: "", description: "", iconUrl: "", active: true };

/* Admin CRUD for the Apps page: create, edit, delete. Icon can be uploaded or a link. */
export default function AppsAdmin() {
  const [apps, setApps] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [iconFile, setIconFile] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  const load = () => api("/apps/all").then((d) => setApps(d.apps)).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  function edit(a) {
    setForm({ ...a });
    setIconFile(null);
    setMsg({ type: "", text: "" });
    window.scrollTo({ top: document.getElementById("apps-admin").offsetTop - 80, behavior: "smooth" });
  }

  function reset() {
    setForm(EMPTY);
    setIconFile(null);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ type: "", text: "" });
    const fd = new FormData();
    ["name", "category", "url", "description", "iconUrl"].forEach((k) => fd.append(k, form[k] || ""));
    fd.append("active", String(!!form.active));
    if (iconFile) fd.append("icon", iconFile);
    try {
      await api(form.id ? `/apps/${form.id}` : "/apps", { method: form.id ? "PATCH" : "POST", form: fd });
      setMsg({ type: "ok", text: form.id ? "App updated" : "App added" });
      reset();
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (!confirm(`Delete "${a.name}"?`)) return;
    try {
      await api(`/apps/${a.id}`, { method: "DELETE" });
      if (form.id === a.id) reset();
      load();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    }
  }

  return (
    <section className="admin-panel" id="apps-admin">
      <h3>Apps page</h3>
      <p className="muted small">These appear on the Apps page. Foods are shown first, then the other categories.</p>

      <form className="card-form app-form" onSubmit={save}>
        <div className="app-form-row">
          <input placeholder="App name (e.g. Swiggy)" maxLength={40} value={form.name} onChange={set("name")} required />
          <select value={form.category} onChange={set("category")}>
            {CATEGORIES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <input placeholder="App link (https://…)" value={form.url} onChange={set("url")} required />
        <input placeholder="Short description (optional)" maxLength={200} value={form.description} onChange={set("description")} />
        <div className="app-form-row">
          <input placeholder="Icon link (https://…) or upload below" value={form.iconUrl} onChange={set("iconUrl")} />
          <label className="pill file-pill">
            {iconFile ? iconFile.name : "Upload icon"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => setIconFile(e.target.files[0] || null)} />
          </label>
        </div>
        <label className="remember">
          <input type="checkbox" checked={!!form.active} onChange={set("active")} /> Show on the Apps page
        </label>
        {msg.text && <p className={msg.type === "error" ? "error" : "ok-text"}>{msg.text}</p>}
        <div className="row">
          <button className="subscribe-btn" disabled={busy}>{busy ? "Saving…" : form.id ? "Save changes" : "Add app"}</button>
          {form.id && <button type="button" className="pill" onClick={reset}>Cancel edit</button>}
        </div>
      </form>

      <div className="table-wrap app-table">
        <table>
          <thead><tr><th>Icon</th><th>Name</th><th>Category</th><th>Status</th><th /></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{a.iconUrl ? <img className="mini-icon" src={a.iconUrl} alt="" /> : <span className="mini-icon letter">{a.name.charAt(0)}</span>}</td>
                <td>{a.name}<div className="muted small">{a.url}</div></td>
                <td>{CATEGORIES.find(([k]) => k === a.category)?.[1] || a.category}</td>
                <td>{a.active ? "Shown" : "Hidden"}</td>
                <td className="row-actions">
                  <button className="pill" onClick={() => edit(a)}>Edit</button>
                  <button className="pill danger" onClick={() => remove(a)}>Delete</button>
                </td>
              </tr>
            ))}
            {apps.length === 0 && <tr><td colSpan={5} className="muted">No apps yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
