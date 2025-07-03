// Extrait l'ID vidéo YouTube depuis une URL
function getYouTubeThumbnail(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\\?v=|embed\\/|v\\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

// Fonction utilitaire pour extraire l’ID vidéo YouTube d’une URL
function getYouTubeVideoId(url) {
  const regExp = /(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|v\\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

// Ajoute une miniature YouTube au message s'il contient un ou plusieurs liens YouTube
function addYouTubeVideoIfAny(messageElement, messageText) {
  const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
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

// Ajoute un message dans la zone de chat
function addMessageToChat(msg) {
  if (msg.username === 'Système') {
    const salonRegex = /salon\\s+(.+)$/i;
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

    usernameSpan.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      const mention = `@${msg.username} `;
      if (!input.value.includes(mention)) input.value = mention + input.value;
      input.focus();
    });
  }

  function isYouTubeUrl(url) {
    return /(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|v\\/))/.test(url);
  }

  const parts = msg.message.split(/(https?:\\/\\/[^\\s]+)/g);

  const messageText = document.createElement('span');
  const style = msg.style || {};
  messageText.style.color = style.color || '#fff';
  messageText.style.fontWeight = style.bold ? 'bold' : 'normal';
  messageText.style.fontStyle = style.italic ? 'italic' : 'normal';
  messageText.style.fontFamily = style.font || 'Arial';

  parts.forEach(part => {
    if (/https?:\\/\\/[^\\s]+/.test(part)) {
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

// Envoi de message
function sendMessage() {
  const input = document.getElementById('message-input');
  if (!input) return;
  const message = input.value.trim();
  const username = localStorage.getItem('username');
  if (!message) return showBanner("Vous ne pouvez pas envoyer de message vide.", 'error');
  if (message.length > 300) return showBanner("Message trop long (300 caractères max).", 'error');

  if (username) {
    socket.emit('chat message', {
      message,
      timestamp: new Date().toISOString(),
      style: loadSavedStyle() 
    });
    input.value = '';
  }
}
