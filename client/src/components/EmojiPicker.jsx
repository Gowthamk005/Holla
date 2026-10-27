import { EMOJI_GROUPS } from "../lib/emoji.js";

export default function EmojiPicker({ onPick }) {
  return (
    <div className="emoji-panel">
      {Object.entries(EMOJI_GROUPS).map(([name, list]) => (
        <div key={name} className="emoji-group">
          <div className="emoji-cat">{name}</div>
          <div className="emoji-row">
            {list.split(" ").map((e) => (
              <button key={e} type="button" onClick={() => onPick(e)} aria-label={e}>{e}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
