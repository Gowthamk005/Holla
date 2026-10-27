import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import OllaQR from "../lib/qr.js";
import { fmtMoney, rupeesToPaise, timeAgo } from "../lib/format.js";

/*
 * Olla Pay. DEMO wallet with play money only. Nothing here touches UPI or a bank.
 * Money is integer paise on the server. The PIN is required for every payment.
 */
export default function Wallet() {
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [pinNew, setPinNew] = useState("");
  const [pay, setPay] = useState({ to: params.get("to") || "", amount: "", note: "", pin: "", requestId: null });
  const [req, setReq] = useState({ to: "", amount: "", note: "" });
  const [scanning, setScanning] = useState(false);
  const qrRef = useRef(null);
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const load = () => api("/wallet").then(setData).catch((e) => setMsg({ type: "error", text: e.message }));
  useEffect(() => { load(); }, []);

  /* draw my own QR (username@olla + name) */
  useEffect(() => {
    if (!data?.me || !qrRef.current) return;
    const payload = `olla-pay://pay?id=${data.me.username}@olla&n=${encodeURIComponent(data.me.name)}`;
    OllaQR.toCanvas(payload, qrRef.current, 220);
  }, [data?.me?.username]);

  function flash(type, text) {
    setMsg({ type, text });
  }

  async function run(fn, okText) {
    try {
      await fn();
      flash("ok", okText);
      load();
    } catch (e) {
      flash("error", e.message);
    }
  }

  async function setPinAction(e) {
    e.preventDefault();
    run(() => api("/wallet/pin", { method: "POST", body: { pin: pinNew } }).then(() => setPinNew("")), "PIN saved");
  }

  async function payAction(e) {
    e.preventDefault();
    const amount = rupeesToPaise(pay.amount);
    if (!amount) return flash("error", "Enter a valid amount (up to 2 decimals).");
    run(async () => {
      await api("/wallet/pay", {
        method: "POST",
        body: { toUsername: pay.to.replace(/@olla$/i, ""), amount, note: pay.note, pin: pay.pin, requestId: pay.requestId },
      });
      setPay({ to: "", amount: "", note: "", pin: "", requestId: null });
    }, "Payment sent");
  }

  async function requestAction(e) {
    e.preventDefault();
    const amount = rupeesToPaise(req.amount);
    if (!amount) return flash("error", "Enter a valid amount.");
    run(async () => {
      await api("/wallet/request", { method: "POST", body: { toUsername: req.to.replace(/@olla$/i, ""), amount, note: req.note } });
      setReq({ to: "", amount: "", note: "" });
    }, "Request sent");
  }

  function fillFromRequest(r) {
    setPay({ to: r.from.username, amount: (r.amount / 100).toFixed(2), note: r.note, pin: "", requestId: r.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* scan a QR using the camera (or a photo) and fill the payment form */
  async function startScan() {
    setScanning(true);
    try {
      scannerRef.current = await OllaQR.startCamera(videoRef.current, (text) => {
        setScanning(false);
        applyScan(text);
      });
    } catch (e) {
      setScanning(false);
      flash("error", e.message);
    }
  }

  function applyScan(text) {
    try {
      const url = new URL(text.replace(/^olla-pay:\/\//i, "https://olla/"));
      const id = (url.searchParams.get("id") || "").toLowerCase();
      if (!/@olla$/.test(id)) throw new Error("Not an Olla Pay QR.");
      const a = parseInt(url.searchParams.get("a") || "", 10);
      setPay((p) => ({ ...p, to: id.replace(/@olla$/, ""), amount: Number.isInteger(a) && a > 0 ? (a / 100).toFixed(2) : p.amount }));
      flash("ok", "QR read. Confirm the amount and enter your PIN.");
    } catch (e) {
      flash("error", e.message || "That QR is not an Olla Pay code.");
    }
  }

  async function scanPhoto(file) {
    if (!file) return;
    try {
      const text = await OllaQR.decodeImageFile(file);
      text ? applyScan(text) : flash("error", "No QR found in that photo.");
    } catch (e) {
      flash("error", e.message);
    }
  }

  function stopScan() {
    scannerRef.current?.stop();
    setScanning(false);
  }

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <div className="wallet">
      <div className="demo-banner"><b>Demo wallet.</b> Play money only. Not connected to UPI or any bank.</div>

      <div className="wallet-card">
        <span>Olla Pay balance</span>
        <div className="wallet-balance">{fmtMoney(data.balance)}</div>
        <div className="wallet-id">@{data.me.username}@olla</div>
        {data.balance < 500000 && <button className="eye-btn" onClick={() => run(() => api("/wallet/topup", { method: "POST" }), "₹500 demo credit added")}>＋ Add demo ₹500</button>}
      </div>

      {msg.text && <p className={msg.type === "error" ? "error" : "ok-text"}>{msg.text}</p>}

      {!data.hasPin ? (
        <form className="card-form" onSubmit={setPinAction}>
          <h3>Create your payment PIN</h3>
          <p className="muted small">You will enter it to confirm every payment (4 to 6 digits).</p>
          <input type="password" inputMode="numeric" maxLength={6} placeholder="New PIN" value={pinNew} onChange={(e) => setPinNew(e.target.value)} />
          <button className="subscribe-btn">Save PIN</button>
        </form>
      ) : (
        <div className="wallet-grid">
          <form className="card-form" onSubmit={payAction}>
            <h3>Send money</h3>
            <input placeholder="Username (e.g. ravi)" value={pay.to} onChange={(e) => setPay({ ...pay, to: e.target.value })} required autoCapitalize="none" />
            <input inputMode="decimal" placeholder="Amount in ₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} required />
            <input placeholder="Note (optional)" maxLength={60} value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
            <input type="password" inputMode="numeric" maxLength={6} placeholder="Your PIN" value={pay.pin} onChange={(e) => setPay({ ...pay, pin: e.target.value })} required />
            {pay.requestId && <p className="muted small">Paying a request. <button type="button" className="link" onClick={() => setPay({ ...pay, requestId: null })}>cancel</button></p>}
            <div className="row">
              <button className="subscribe-btn">Pay</button>
              <button type="button" className="pill" onClick={startScan}>📷 Scan QR</button>
              <label className="pill">📁 From photo<input type="file" accept="image/*" hidden onChange={(e) => scanPhoto(e.target.files[0])} /></label>
            </div>
          </form>

          <form className="card-form" onSubmit={requestAction}>
            <h3>Request money</h3>
            <input placeholder="From username" value={req.to} onChange={(e) => setReq({ ...req, to: e.target.value })} required autoCapitalize="none" />
            <input inputMode="decimal" placeholder="Amount in ₹" value={req.amount} onChange={(e) => setReq({ ...req, amount: e.target.value })} required />
            <input placeholder="Note (optional)" maxLength={60} value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} />
            <button className="subscribe-btn">Send request</button>
          </form>

          <div className="card-form">
            <h3>My QR</h3>
            <canvas ref={qrRef} className="my-qr" />
            <p className="muted small">Others scan this to pay you. Amount is entered by the payer.</p>
          </div>
        </div>
      )}

      {scanning && (
        <div className="scan-box">
          <video ref={videoRef} playsInline muted />
          <button className="pill" onClick={stopScan}>Cancel</button>
        </div>
      )}

      {data.requests.incoming.length > 0 && (
        <section>
          <h3 className="section-title">Requests for you</h3>
          {data.requests.incoming.map((r) => (
            <div className="row-card" key={r.id}>
              <div className="grow"><b>@{r.from.username}</b> requests {fmtMoney(r.amount)}<div className="muted small">{r.note}</div></div>
              <button className="subscribe-btn" onClick={() => fillFromRequest(r)}>Pay</button>
              <button className="pill" onClick={() => run(() => api(`/wallet/requests/${r.id}/decline`, { method: "POST" }), "Request declined")}>Decline</button>
            </div>
          ))}
        </section>
      )}

      {data.requests.outgoing.length > 0 && (
        <section>
          <h3 className="section-title">Requests you sent</h3>
          {data.requests.outgoing.map((r) => (
            <div className="row-card" key={r.id}>
              <div className="grow">{fmtMoney(r.amount)} from @{r.to.username}<div className="muted small">{r.status}</div></div>
            </div>
          ))}
        </section>
      )}

      <section>
        <h3 className="section-title">Transactions</h3>
        {data.transactions.length === 0 && <p className="muted">No transactions yet.</p>}
        {data.transactions.map((t) => {
          const incoming = t.to.username === data.me.username;
          const other = incoming ? t.from : t.to;
          return (
            <div className="tx-row" key={t.id}>
              <div className="grow">
                <div className="tx-title">{t.kind === "topup" ? "Demo credit" : incoming ? `From @${other?.username}` : `To @${other?.username}`}</div>
                <div className="muted small">{timeAgo(t.createdAt)}{t.note ? ` · ${t.note}` : ""} · {t.txId}</div>
              </div>
              <div className={incoming ? "tx-amount in" : "tx-amount"}>{incoming ? "+" : "−"}{fmtMoney(t.amount)}</div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
