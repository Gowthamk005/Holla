import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar.jsx";

/* Popup for a new chat message from a friend. Tap it to open the chat. It closes itself after 5 seconds. */
export default function ChatToast({ alert, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!alert) return undefined;
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [alert, onClose]);

  if (!alert) return null;
  const { sender, message } = alert;
  const preview = message.text || (message.attachment ? "📎 Sent you a file" : "Sent you a message");

  return (
    <div className="chat-toast" role="status" aria-live="polite">
      <button className="chat-toast-main" onClick={() => { onClose(); navigate(`/messages/${sender.id}`); }}>
        <Avatar user={sender} size="sm" />
        <span className="chat-toast-text">
          <b>{sender.name}</b>
          <span>{preview}</span>
        </span>
      </button>
      <button className="chat-toast-x" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
