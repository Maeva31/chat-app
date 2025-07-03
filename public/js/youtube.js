// youtube.js

// ✅ Extrait l’ID d’une vidéo YouTube depuis une URL
export function getYouTubeVideoId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// ✅ Retourne l’URL de la miniature de la vidéo (non utilisée par défaut)
export function getYouTubeThumbnail(url) {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

// ✅ Vérifie si une URL est une vidéo YouTube
export function isYouTubeUrl(url) {
  return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))/.test(url);
}

// ✅ Ajoute un lecteur intégré (iframe) YouTube dans un élément HTML si lien détecté
export function addYouTubeVideoIfAny(messageElement, messageText) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = messageText.match(urlRegex);
  if (!urls) return;

  urls.forEach(url => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('youtube-wrapper');

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${videoId}?controls=1`;
      iframe.frameBorder = '0';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;

      wrapper.appendChild(iframe);
      messageElement.appendChild(wrapper);
    }
  });
}

      if (part.trim() !== '') {
        messageText.appendChild(document.createTextNode(part));
      }
    }
  });
