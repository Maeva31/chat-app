function getYouTubeThumbnail(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}


// Ajoute une miniature YouTube au message s'il contient un ou plusieurs liens YouTube
function addYouTubeVideoIfAny(messageElement, messageText) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = messageText.match(urlRegex);
  if (!urls) return;

  urls.forEach(url => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('youtube-wrapper');

      // Création de la miniature image
      const thumbnail = document.createElement('img');
      thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      thumbnail.alt = "YouTube Video Thumbnail";
      thumbnail.style.cursor = 'pointer';
      thumbnail.style.maxWidth = '480px';
      thumbnail.style.width = '100%';
      thumbnail.style.height = 'auto';

      // Au clic sur la miniature, remplacer par l'iframe qui lance la vidéo
      thumbnail.addEventListener('click', () => {
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1`;
        iframe.frameBorder = '0';
        iframe.allow =
          'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.width = '100%';
        iframe.style.height = '270px';

        wrapper.replaceChild(iframe, thumbnail);
      });

      wrapper.appendChild(thumbnail);
      messageElement.appendChild(wrapper);
    }
  });
}







// Fonction utilitaire pour extraire l’ID vidéo YouTube d’une URL
function getYouTubeVideoId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}



  // Ajoute un message dans la zone de chat
  function addMessageToChat(msg) {
  if (msg.username === 'Système') {
    const salonRegex = /salon\s+(.+)$/i;
    const match = salonRegex.exec(msg.message);
    if (match && match[1]) {
      const salonDuMessage = match[1].trim();
      if (salonDuMessage !== currentChannel) return;
    }
  }

  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const newMessage = document.createElement('div');
  const date = new Date(msg.timestamp);
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const usernameSpan = document.createElement('span');
  const color = (msg.role === 'admin') ? 'red' :
                (msg.role === 'modo') ? 'green' :
                getUsernameColor(msg.gender);

  if (msg.username === 'Système') {
    usernameSpan.textContent = msg.username;
    usernameSpan.style.color = '#888';
    usernameSpan.style.fontWeight = 'bold';
  } else {
    usernameSpan.classList.add('clickable-username');
    usernameSpan.style.color = color;
    usernameSpan.textContent = msg.username;
    usernameSpan.title = (msg.role === 'admin') ? 'Admin' :
                         (msg.role === 'modo') ? 'Modérateur' : '';

    // Icônes selon rôle
    if (msg.role === 'admin') {
      const icon = document.createElement('img');
      icon.src = '/favicon.ico';
      icon.alt = 'Admin';
      icon.title = 'Admin';
      icon.style.width = '18px';
      icon.style.height = '18px';
      icon.style.marginRight = '0px';
      icon.style.verticalAlign = '-4px';
      usernameSpan.insertBefore(icon, usernameSpan.firstChild);
    } else if (msg.role === 'modo') {
      const icon = document.createElement('span');
      icon.textContent = '🛡️';
      icon.title = 'Modérateur';
      icon.style.marginRight = '0px';
      icon.style.verticalAlign = '0px';
      usernameSpan.insertBefore(icon, usernameSpan.firstChild);
    }

    // Clic pour mentionner
    usernameSpan.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      const mention = `@${msg.username} `;
      if (!input.value.includes(mention)) input.value = mention + input.value;
      input.focus();
    });
  }

  function isYouTubeUrl(url) {
    return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))/.test(url);
  }

  const parts = msg.message.split(/(https?:\/\/[^\s]+)/g);

  const messageText = document.createElement('span');
  const style = msg.style || {};
  messageText.style.color = style.color || '#fff';
  messageText.style.fontWeight = style.bold ? 'bold' : 'normal';
  messageText.style.fontStyle = style.italic ? 'italic' : 'normal';
  messageText.style.fontFamily = style.font || 'Arial';

  parts.forEach(part => {
    if (/https?:\/\/[^\s]+/.test(part)) {
      if (isYouTubeUrl(part)) {
        return; // ignore dans texte, vidéo intégrée ailleurs
      } else {
        const a = document.createElement('a');
        a.href = part;
        a.textContent = part;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.color = style.color || '#00aaff';
        a.style.textDecoration = 'underline';
        messageText.appendChild(a);
      }
    } else {
      if (part.trim() !== '') {
        messageText.appendChild(document.createTextNode(part));
      }
    }
  });

  // Assemblage avec pseudo + ":" + espace + message
  newMessage.innerHTML = `[${timeString}] `;
  newMessage.appendChild(usernameSpan);

  // Ajouter ":" + espace après le pseudo uniquement si message non vide
  // Ajouter ":" + espace après le pseudo uniquement si message non vide, en gras
if (messageText.textContent.trim() !== '') {
  const separator = document.createElement('strong');
  separator.textContent = ': ';
  newMessage.appendChild(separator);
  newMessage.appendChild(messageText);
}


  newMessage.classList.add('message');
  newMessage.dataset.username = msg.username;

  addYouTubeVideoIfAny(newMessage, msg.message);

  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
