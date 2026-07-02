// YouTube URL helpers shared by the music player and track forms.

export function getYoutubeEmbed(url, autoplay = false) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?enablejsapi=1${autoplay ? '&autoplay=1' : ''}`;
}

export function getYoutubeThumbnail(url) {
  const match = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}
