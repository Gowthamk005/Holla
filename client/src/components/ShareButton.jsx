import { useState } from "react";

/*
 * Share button.
 * - On a phone it opens the phone's own share sheet. That sheet lists only the apps the person
 *   has installed (Instagram, WhatsApp, ...). A web page cannot see which apps are installed.
 * - Where that sheet is not available (most computers), it shows the common share links and Copy link.
 */
export default function ShareButton({ url, title, className = "pill", children = "↗ Share" }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: title, url });
      } catch {
        /* the person closed the sheet */
      }
      return;
    }
    setOpen(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked: the link is still shown in the box */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const options = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${t}&url=${u}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "Email", href: `mailto:?subject=${t}&body=${encodeURIComponent(url)}` },
  ];

  return (
    <>
      <button className={className} onClick={share}>{children}</button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet share-sheet" role="dialog" aria-label="Share" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <b>Share</b>
              <button className="icon-plain" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="share-grid">
              {options.map((o) => (
                <a key={o.label} href={o.href} target="_blank" rel="noopener noreferrer" className="share-opt">{o.label}</a>
              ))}
            </div>
            <div className="share-link">
              <input readOnly value={url} onFocus={(e) => e.target.select()} />
              <button className="pill" onClick={copy}>{copied ? "Copied ✓" : "Copy link"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
