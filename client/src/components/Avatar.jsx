export default function Avatar({ user, channel, size = "md", online = false }) {
  const who = user || channel || {};
  const name = who.name || who.username || "?";
  const cls = `avatar ${size}${online ? " online" : ""}`;
  if (who.avatarUrl) {
    return <img className={cls} src={who.avatarUrl} alt="" />;
  }
  return <span className={`${cls} avatar-initial`}>{name.trim().charAt(0).toUpperCase()}</span>;
}
