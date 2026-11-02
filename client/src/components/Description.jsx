import { Link } from "react-router-dom";

/* Shows a description with every #hashtag as a link to its tag page */
export default function Description({ text }) {
  if (!text) return <p className="desc-text muted">No description.</p>;
  return (
    <p className="desc-text">
      {text.split(/(#[\p{L}\p{M}\p{N}_]{1,50})/u).map((part, i) =>
        i % 2 === 1 ? (
          <Link key={i} to={`/tag/${part.slice(1).toLowerCase()}`} className="hashtag">{part}</Link>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}
