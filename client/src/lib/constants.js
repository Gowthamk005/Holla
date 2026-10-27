export const CATEGORIES = [
  { key: "movies", label: "Movies", icon: "🎬" },
  { key: "music", label: "Music", icon: "🎵" },
  { key: "gaming", label: "Gaming", icon: "🎮" },
  { key: "comedy", label: "Comedy", icon: "😂" },
  { key: "education", label: "Education", icon: "📚" },
  { key: "travel", label: "Travel", icon: "✈️" },
  { key: "food", label: "Food", icon: "🍜" },
  { key: "motivation", label: "Motivation", icon: "💪" },
  { key: "news", label: "News", icon: "📰" },
];

export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || key;
