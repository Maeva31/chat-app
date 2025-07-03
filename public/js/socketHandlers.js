import { addMessageToChat, extractChannelName, showBanner, updateUserList } from './chatUtils.js';
import { loadSavedStyle } from './styleManager.js';

export function initSocketHandlers() {
  window.socket = io(); // global pour UI et autres modules
  window.currentChannel = 'Général';

  const socket = window.socket;

  socket.on('joinedRoom', (newChannel) => {
    window.currentChannel = newChannel;
    localStorage.setItem('currentChannel', newChannel);
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    socket.emit('request history', newChannel);
  });

  socket.on('chat message', addMessageToChat);
  socket.on('chat history', (messages) => {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    messages.forEach(addMessageToChat);
  });

  socket.on('username accepted', ({ username, gender, age }) => {
    localStorage.setItem('username', username);
    localStorage.setItem('gender', gender);
    localStorage.setItem('age', age);

    const modal = document.getElementById('myModal');
    if (modal) modal.style.display = 'none';
    const chatWrapper = document.getElementById('chat-wrapper');
    if (chatWrapper) chatWrapper.style.display = 'block';

    socket.emit('joinRoom', window.currentChannel);

    window.hasSentUserInfo = true;
    window.initialLoadComplete = true;
  });

  socket.on('username error', msg => showBanner(msg, 'error'));

  socket.on('username exists', username => {
    const modalError = document.getElementById('modal-error');
    if (!modalError) return;
    modalError.textContent = `❌ Le nom "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = 'block';
  });

  socket.on('server message', msg => {
    addMessageToChat({
      username: 'Système',
      message: msg,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('user list', updateUserList);

  socket.on('room created', newChannel => {
    const channelList = document.getElementById('channel-list');
    if (!channelList) return;

    // Protection avant extractChannelName
    const exists = [...channelList.children].some(li => {
      if (!li || typeof li.textContent !== 'string') return false;
      return extractChannelName(li.textContent) === newChannel;
    });

    if (!exists) {
      const li = document.createElement('li');
      li.classList.add('channel');
      const emoji = {
        "Général": "💬",
        "Musique": "🎧",
        "Gaming": "🎮",
        "Détente": "🌿"
      }[newChannel] || "🆕";

      li.textContent = `# ${emoji} ┊ ${newChannel} (0)`;
      li.addEventListener('click', () => {
        if (window.currentChannel === newChannel) return;
        window.currentChannel = newChannel;
        localStorage.setItem('currentChannel', window.currentChannel);
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        socket.emit('joinRoom', window.currentChannel);
      });
      channelList.appendChild(li);
    }

    showBanner(`Salon "${newChannel}" créé avec succès !`, 'success');
  });

  socket.on('roomUserCounts', (counts) => {
    const channelList = document.getElementById('channel-list');
    if (!channelList) return;

    [...channelList.children].forEach(li => {
      if (!li || typeof li.textContent !== 'string') return;
      const name = extractChannelName(li.textContent);
      if (!name) return;
      if (counts[name] === undefined) return;

      const emoji = {
        "Général": "💬",
        "Musique": "🎧",
        "Gaming": "🎮",
        "Détente": "🌿"
      }[name] || "💬";

      let countSpan = li.querySelector('.user-count');
      if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.classList.add('user-count');
        li.appendChild(countSpan);
      }

      const invisibleMode = localStorage.getItem('invisibleMode') === 'true';
      if (invisibleMode && name === window.currentChannel) {
        countSpan.textContent = '';
        // Attention li.firstChild peut être un textNode, on remplace textContent complet
        li.textContent = `# ${emoji} ┊ ${name} `;
        li.appendChild(countSpan); // On rajoute le span vide
      } else {
        countSpan.textContent = ` (${counts[name]})`;
        li.textContent = `# ${emoji} ┊ ${name} `;
        li.appendChild(countSpan);
      }
    });
  });

  socket.on('room list', (rooms) => {
    const channelList = document.getElementById('channel-list');
    if (!channelList) return;
    const previousChannel = window.currentChannel;

    channelList.innerHTML = '';

    rooms.forEach(channelName => {
      const li = document.createElement('li');
      li.classList.add('channel');
      const emoji = {
        "Général": "💬",
        "Musique": "🎧",
        "Gaming": "🎮",
        "Détente": "🌿"
      }[channelName] || "💬";

      li.textContent = `# ${emoji} ┊ ${channelName} (0)`;

      li.addEventListener('click', () => {
        if (window.currentChannel === channelName) return;
        window.currentChannel = channelName;
        localStorage.setItem('currentChannel', window.currentChannel);
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        socket.emit('joinRoom', window.currentChannel);
      });

      channelList.appendChild(li);
    });

    if (!rooms.includes(previousChannel)) {
      window.currentChannel = 'Général';
      localStorage.setItem('currentChannel', window.currentChannel);
      socket.emit('joinRoom', window.currentChannel);
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';
    }
  });

  // Ping périodique
  setInterval(() => {
    socket.emit('ping');
  }, 10000);

  // Envoi message avec touche Entrée
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const message = messageInput.value.trim();
        if (!message) return showBanner("Vous ne pouvez pas envoyer de message vide.", 'error');
        if (message.length > 300) return showBanner("Message trop long (300 caractères max).", 'error');

        socket.emit('chat message', {
          message,
          timestamp: new Date().toISOString(),
          style: loadSavedStyle()
        });

        messageInput.value = '';
      }
    });
  }

  // Gestion reconnexion automatique
  socket.on('connect', () => {
    const savedUsername = localStorage.getItem('username');
    const savedGender = localStorage.getItem('gender');
    const savedAge = localStorage.getItem('age');
    const savedPassword = localStorage.getItem('password');

    if (!window.hasSentUserInfo && savedUsername && savedAge) {
      socket.emit('set username', {
        username: savedUsername,
        gender: savedGender || 'non spécifié',
        age: savedAge,
        invisible: localStorage.getItem('invisibleMode') === 'true',
        password: savedPassword || ''
      });
      window.currentChannel = 'Général';
      localStorage.setItem('currentChannel', window.currentChannel);
      socket.emit('joinRoom', window.currentChannel);

      window.hasSentUserInfo = true;
      window.initialLoadComplete = true;

      if (localStorage.getItem('invisibleMode') === 'true') {
        showBanner('Mode invisible activé (auto)', 'success');
      }
    }
  });

  // Modération
  socket.on('banned', () => {
    showBanner('🚫 Vous avez été banni du serveur.', 'error');
    socket.disconnect();
  });
  socket.on('kicked', () => {
    showBanner('👢 Vous avez été expulsé du serveur.', 'error');
    socket.disconnect();
  });
  socket.on('muted', () => showBanner('🔇 Vous avez été muté et ne pouvez plus envoyer de messages.', 'error'));
  socket.on('unmuted', () => showBanner('🔊 Vous avez été unmuté, vous pouvez à nouveau envoyer des messages.', 'success'));
  socket.on('error message', msg => showBanner(`❗ ${msg}`, 'error'));
  socket.on('no permission', () => showBanner("Vous n'avez pas les droits pour utiliser les commandes.", "error"));

  socket.on('redirect', (url) => {
    if (typeof url === 'string' && url.length > 0) {
      window.location.href = url;
    }
  });
}
