export const channelEmojis = {
  "Général": "💬",
  "Musique": "🎧",
  "Gaming": "🎮",
  "Détente": "🌿"
};

export function extractChannelName(text) {
  text = text.replace(/\s*\(\d+\)$/, '').trim();
  const parts = text.split('┊');
  if (parts.length > 1) return parts[1].trim();
  return text.replace(/^#?\s*[\p{L}\p{N}\p{S}\p{P}\s]*/u, '').trim();
}
