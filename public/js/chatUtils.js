const genderColors = {
  Homme: '#00f',
  Femme: '#f0f',
  Autre: '#0ff',
  'non spécifié': '#aaa',
  default: '#aaa'
};

const channelEmojis = {
  "Général": "💬",
  "Musique": "🎧",
  "Gaming": "🎮",
  "Détente": "🌿"
};

export function getUsernameColor(gender) {
  return genderColors[gender] || genderColors.default;
}

export function extractChannelName(text) {
  text = text.replace(/\s*\(\d+\)$/, '').trim();
  const parts = text.split('┊');
  if (parts.length > 1) return parts[1].trim();
  return text.replace(/^#?\s*[\p{L}\p{N}\p{S}\p{P}\s]*/u, '').trim();
}

export function showBanner(message, type = 'error') {
  if (!window.initialLoadComplete) return;
  const banner = document.getElementById('error-banner');
  const text = document.getElementById('error-banner-text');
  if (!banner || !text) return;

  const prefix = type === 'success' ? '✅' : '❌';
  text.textContent = `${prefix} ${message}`;
  banner.style.display = 'flex';
  banner.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';

  if (window.bannerTimeoutId) clearTimeout(window.bannerTimeoutId);
  window.bannerTimeoutId = setTimeout(() => {
    banner.style.display = 'none';
    window.bannerTimeoutId = null;
  }, 5000);
}

export function updateUserList(users) {
  const userList = document.getElementById('users');
  if (!userList) return;
  userList.innerHTML = '';
  if (!Array.isArray(users)) return;

  users.forEach(user => {
    const username = user?.username || 'Inconnu';
    const age = user?.age || '?';
    const gender = user?.gender || 'non spécifié';
    const role = user?.role || 'user';

    const li = document.createElement('li');
    li.classList.add('user-item');

    const color = role === 'admin' ? 'red' : role === 'modo' ? 'green' : getUsernameColor(gender);

    li.innerHTML = `
      <span class="role-icon"></span> 
      <div class="gender-square" style="background-color: ${getUsernameColor(gender)}">${age}</div>
      <span class="username-span clickable-username" style="color: ${color}" title="${role === 'admin' ? 'Admin' : role === 'modo' ? 'Modérateur' : ''}">${username}</span>
    `;

    const roleIconSpan = li.querySelector('.role-icon');
    if (role === 'admin') {
      const icon = document.createElement('img');
      icon.src = '/favicon.ico';
      icon.alt = 'Admin';
      icon.title = 'Admin';
      icon.classList.add('admin-icon');
      roleIconSpan.appendChild(icon);
    } else if (role === 'modo') {
      const icon = document.createElement('span');
      icon.textContent = '🛡️';
      icon.title = 'Modérateur';
      icon.classList.add('modo-icon');
      roleIconSpan.appendChild(icon);
    }

    const usernameSpan = li.querySelector('.username-span');
    usernameSpan.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      const mention = `@${username} `;
      if (!input.value.includes(mention)) input.value = mention + input.value;
      input.focus();
      window.selectedUser = username;
    });

    userList.appendChild(li);
  });
}

export function addMessageToChat(msg) {
  if (msg.username === 'Système') {
    const salonRegex = /salon\s+(.+)$/i;
    const match = salonRegex.exec(msg.message);
    if (match && match[1]) {
      const salonDuMessage = match[1].trim();
      if (salonDuMessage !== window.currentChannel) return;
    }
  }

  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const newMessage = document.createElement('div');
  newMessage.classList.add('message');
  newMessage.style.wordWrap = 'break-word';

  const time = new Date(msg.timestamp);
  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const userNameSpan = document.createElement('span');
  userNameSpan.classList.add('username-span');
  userNameSpan.textContent = msg.username + ': ';
  userNameSpan.style.color = msg.style?.color || getUsernameColor(msg.gender);

  if (msg.style?.bold) userNameSpan.style.fontWeight = 'bold';
  if (msg.style?.italic) userNameSpan.style.fontStyle = 'italic';
  if (msg.style?.font) userNameSpan.style.fontFamily = msg.style.font;

  // Icônes selon rôle
  if (msg.role === 'admin') {
    const adminIcon = document.createElement('img');
    adminIcon.src = '/favicon.ico';
    adminIcon.alt = 'Admin';
    adminIcon.title = 'Admin';
    adminIcon.classList.add('admin-icon');
    userNameSpan.prepend(adminIcon);
  } else if (msg.role === 'modo') {
    const modoIcon = document.createElement('span');
    modoIcon.textContent = '🛡️';
    modoIcon.title = 'Modérateur';
    modoIcon.classList.add('modo-icon');
    userNameSpan.prepend(modoIcon);
  }

  // Ajouter le message
  const messageContent = document.createElement('span');
  messageContent.classList.add('message-content');
  messageContent.textContent = msg.message;
  if (msg.style?.bold) messageContent.style.fontWeight = 'bold';
  if (msg.style?.italic) messageContent.style.fontStyle = 'italic';
  if (msg.style?.font) messageContent.style.fontFamily = msg.style.font;
  if (msg.style?.color) messageContent.style.color = msg.style.color;

  // Time
  const timeSpan = document.createElement('span');
  timeSpan.classList.add('message-timestamp');
  timeSpan.textContent = ` [${formattedTime}]`;

  newMessage.appendChild(userNameSpan);
  newMessage.appendChild(messageContent);
  newMessage.appendChild(timeSpan);

  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
