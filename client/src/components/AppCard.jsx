export default function AppCard({ app, onOpen }) {
  return (
    <a
      className="app-tile"
      href={app.url}
      target="_blank"
      rel="noopener noreferrer"
      title={app.description || app.name}
      onClick={() => onOpen?.(app)}
    >
      {app.iconUrl
        ? <img className="app-tile-icon" src={app.iconUrl} alt="" loading="lazy" />
        : <span className="app-tile-icon app-tile-letter">{app.name.charAt(0).toUpperCase()}</span>}
      <span className="app-tile-name">{app.name}</span>
    </a>
  );
}