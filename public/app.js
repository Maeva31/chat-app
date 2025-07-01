document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Variables globales
  let currentChannel = localStorage.getItem('currentChannel') || 'Général';
  let hasSentUserInfo = false;
  let initialLoadComplete = false;
  let invisibleMode = localStorage.getItem('invisibleMode') === 'true' || false;
  let selectedUser = null;
  let bannerTimeoutId = null;
  let isAdmin = false;

  const specialRoles = ['admin', 'modo', 'MaEvA'];

  // Couleurs par genre
  const genderColors = {
    Homme: '#00f',
    Femme: '#f0f',
    Autre: '#0ff',
    'non spécifié': '#aaa',
    default: '#aaa'
  };

  // Emojis par salon
  const channelEmojis = {
    "Général": "💬",
    "Musique": "🎧",
    "Gaming": "🎮",
    "Détente": "🌿"
  };

  // Elements UI
  const modal = document.getElementById('myModal');
  const chatWrapper = document.getElementById('chat-wrapper');
  const usernameInput = document.getElementById('username-input');
  const genderSelect = document.getElementById('gender-select');
  const ageInput = document.getElementById('age-input');
  const modalError = document.getElementById('modal-error');
  const passwordInput = document.getElementById('password-input');
  const invisibleBtn = document.getElementById('toggle-invisible-btn');
  const channelList = document.getElementById('channel-list');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const emojiButton = document.getElementById('emoji-button');
  const emojiPicker = document.getElementById('emoji-picker');
  const createChannelButton = document.getElementById('create-channel-button');
  const newChannelNameInput = document.getElementById('new-channel-name');
  const usernameSubmitBtn = document.getElementById('username-submit');
  const errorBanner = document.getElementById('error-banner');
  const errorBannerText = document.getElementById('error-banner-text');

  // Affiche la modal si pas de pseudo sauvegardé
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
    if (modal) modal.style.display = 'block';
  } else {
    if (chatWrapper) chatWrapper.style.display = 'block';
  }

  // Affichage du champ mot de passe si pseudo spécial
  function checkSpecialRoleInput() {
    if (!usernameInput || !passwordInput) return;
    const val = usernameInput.value.trim();
    if (specialRoles.includes(val)) {
      passwordInput.style.display = 'block';
    } else {
      passwordInput.style.display = 'none';
      passwordInput.value = '';
    }
  }

  if (usernameInput) {
    usernameInput.addEventListener('input', checkSpecialRoleInput);
    checkSpecialRoleInput();
  }

  // Mise à jour bouton mode invisible
  function updateInvisibleButton() {
    if (!invisibleBtn) return;
    invisibleBtn.textContent = `👻 Mode Invisible`;
    invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
  }

  if (invisibleBtn) {
    // Montrer ou cacher le bouton selon mode invisible ou admin
    if (invisibleMode) {
      invisibleBtn.style.display = 'inline-block';
      updateInvisibleButton();
    } else {
      invisibleBtn.style.display = 'none';
    }
  }

  // Fonction affichage bannière temporaire
  function showBanner(message, type = 'error') {
    if (!initialLoadComplete) return;
    if (!errorBanner || !errorBannerText) return;

    const prefix = type === 'success' ? '✅' : '❌';
    errorBannerText.textContent = `${prefix} ${message}`;
    errorBanner.style.display = 'flex';
    errorBanner.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';

    if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
      errorBanner.style.display = 'none';
      bannerTimeoutId = null;
    }, 5000);
  }

  // Couleur selon genre
  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // Extraction nom canal depuis texte (ex: "# 💬 ┊ Général (2)" => "Général")
  function extractChannelName(text) {
    text = text.replace(/\s*\(\d+\)$/, '').trim();
    const parts = text.split('┊');
    if (parts.length > 1) return parts[1].trim();
    return text.replace(/^#?\s*[\p{L}\p{N}\p{S}\p{P}\s]*/u, '').trim();
  }

  // Met à jour la liste des utilisateurs affichée
  function updateUserList(users) {
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
        <div class="gender-square" style="background-color: ${getUsernameColor(gender)}">${age}</div>
        <span class="username-span clickable-username" style="color: ${color}" title="${role === 'admin' ? 'Admin' : role === 'modo' ? 'Modérateur' : ''}">${username}</span>
      `;

      const usernameSpan = li.querySelector('.username-span');
      if (role === 'admin') {
        const icon = document.createElement('img');
        icon.src = '/favicon.ico';
        icon.alt = 'Admin';
        icon.title = 'Admin';
        icon.classList.add('admin-icon');
        usernameSpan.appendChild(icon);
      } else if (role === 'modo') {
        const icon = document.createElement('span');
        icon.textContent = '🛡️';
        icon.title = 'Modérateur';
        icon.classList.add('modo-icon');
        usernameSpan.appendChild(icon);
      }

      usernameSpan.addEventListener('click', () => {
        if (!messageInput) return;
        const mention = `@${username} `;
        if (!messageInput.value.includes(mention)) messageInput.value = mention + messageInput.value;
        messageInput.focus();
        selectedUser = username;
      });

      userList.appendChild(li);
    });
  }

  // Ajoute un message dans la zone de chat
  function addMessageToChat(msg) {
    if (!chatMessages) return;

    // Filtrer messages systèmes hors salon courant
    if (msg.username === 'Système') {
      const salonRegex = /salon\s+(.+)$/i;
      const match = salonRegex.exec(msg.message);
      if (match && match[1]) {
        const salonDuMessage = match[1].trim();
        if (salonDuMessage !== currentChannel) {
          return; // Ne pas afficher
        }
      }
    }

    const newMessage = document.createElement('div');

    const date = new Date(msg.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const usernameSpan = document.createElement('span');

    if (msg.username === 'Système') {
      usernameSpan.textContent = msg.username;
      usernameSpan.style.color = '#888';
      usernameSpan.style.fontWeight = 'bold';
    } else {
      const color = (msg.role === 'admin') ? 'red' : (msg.role === 'modo' ? 'green' : getUsernameColor(msg.gender));
      usernameSpan.classList.add('clickable-username');
      usernameSpan.style.color = color;

      usernameSpan.textContent = msg.username;
      usernameSpan.title = (msg.role === 'admin') ? 'Admin' : (msg.role === 'modo' ? 'Modérateur' : '');

      if (msg.role === 'admin') {
        const icon = document.createElement('img');
        icon.src = '/favicon.ico';
        icon.alt = 'Admin';
        icon.title = 'Admin';
        icon.style.width = '16px';
        icon.style.height = '16px';
        icon.style.marginLeft = '4px';
        icon.style.verticalAlign = 'middle';
        usernameSpan.appendChild(icon);
      } else if (msg.role === 'modo') {
        const icon = document.createElement('span');
        icon.textContent = '🛡️';
        icon.title = 'Modérateur';
        icon.style.marginLeft = '4px';
        icon.style.verticalAlign = 'middle';
        usernameSpan.appendChild(icon);
      }

      usernameSpan.addEventListener('click', () => {
        if (!messageInput) return;
        const mention = `@${msg.username} `;
        if (!messageInput.value.includes(mention)) messageInput.value = mention + messageInput.value;
        messageInput.focus();
      });
    }

    newMessage.innerHTML = `[${timeString}] `;
    newMessage.appendChild(usernameSpan);
    newMessage.append(`: ${msg.message}`);
    newMessage.classList.add('message');
    newMessage.dataset.username = msg.username;

    chatMessages.appendChild(newMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Sélection visuelle du salon
  function selectChannelInUI(channelName) {
    document.querySelectorAll('.channel').forEach(c => {
      if (extractChannelName(c.textContent) === channelName) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  }

  // Soumission du formulaire pseudo + validations
  function submitUserInfo() {
    if (!usernameInput || !genderSelect || !ageInput || !modalError) return;

    const username = usernameInput.value.trim();
    const gender = genderSelect.value;
    const age = parseInt(ageInput.value.trim(), 10);
    const password = passwordInput?.value?.trim() || '';

    // Validations
    if (!username || username.includes(' ') || username.length > 16) {
      modalError.textContent = "Le pseudo ne doit pas contenir d'espaces et doit faire 16 caractères max.";
      modalError.style.display = 'block';
      return;
    }
    if (isNaN(age) || age < 18 || age > 89) {
      modalError.textContent = "L'âge doit être un nombre entre 18 et 89.";
      modalError.style.display = 'block';
      return;
    }
    if (!gender) {
      modalError.textContent = "Veuillez sélectionner un genre.";
      modalError.style.display = 'block';
      return;
    }

    modalError.style.display = 'none';

    // Envoi au serveur
    socket.emit('set username', {
      username,
      gender,
      age,
      invisible: invisibleMode,
      password
    });
  }

  // Envoi message au serveur
  function sendMessage() {
    if (!messageInput) return;
    const message = messageInput.value.trim();
    const username = localStorage.getItem('username');
    if (!message) return showBanner("Vous ne pouvez pas envoyer de message vide.", 'error');
    if (message.length > 300) return showBanner("Message trop long (300 caractères max).", 'error');

    if (username) {
      socket.emit('chat message', {
        message,
        timestamp: new Date().toISOString(),
      });
      messageInput.value = '';
    }
  }

  // Événements socket

  socket.on('connect', () => {
    const savedUsername = localStorage.getItem('username');
    const savedGender = localStorage.getItem('gender');
    const savedAge = localStorage.getItem('age');
    const savedPassword = localStorage.getItem('password') || '';

    if (!hasSentUserInfo && savedUsername && savedAge) {
      socket.emit('set username', {
        username: savedUsername,
        gender: savedGender || 'non spécifié',
        age: savedAge,
        invisible: invisibleMode,
        password: savedPassword
      });

      // Join room
      if (!currentChannel) {
        currentChannel = localStorage.getItem('currentChannel') || 'Général';
        localStorage.setItem('currentChannel', currentChannel);
      }

      socket.emit('joinRoom', currentChannel);
      selectChannelInUI(currentChannel);

      hasSentUserInfo = true;
      initialLoadComplete = true;

      if (invisibleMode) {
        showBanner('Mode invisible activé (auto)', 'success');
      }
    }
  });

  socket.once('username accepted', ({ username, gender, age }) => {
    localStorage.setItem('username', username);
    localStorage.setItem('gender', gender);
    localStorage.setItem('age', age);

    if (modal) modal.style.display = 'none';
    if (chatWrapper) chatWrapper.style.display = 'block';

    socket.emit('joinRoom', currentChannel);
    selectChannelInUI(currentChannel);

    hasSentUserInfo = true;
    initialLoadComplete = true;
  });

  socket.on('username error', msg => showBanner(msg, 'error'));

  socket.on('username exists', (username) => {
    if (!modalError) return;
    modalError.textContent = `❌ Le nom "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = 'block';
  });

  socket.on('chat history', (messages) => {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    messages.forEach(addMessageToChat);
  });

  socket.on('chat message', addMessageToChat);

  socket.on('server message', (msg) => {
    const message = {
      username: 'Système',
      message: msg,
      timestamp: new Date().toISOString()
    };
    addMessageToChat(message);
  });

  socket.on('user list', users => {
    updateUserList(users);

    // Gestion bouton mode invisible admin
    const username = localStorage.getItem('username');
    const me = users.find(u => u.username === username);
    if (me && me.role === 'admin') {
      if (!isAdmin) isAdmin = true;
      if (invisibleBtn) {
        invisibleBtn.style.display = 'inline-block';
        updateInvisibleButton();
      }
    } else {
      if (isAdmin) {
        isAdmin = false;
        if (!invisibleMode && invisibleBtn) {
          invisibleBtn.style.display = 'none';
        }
      }
    }
  });

  socket.on('room created', (newChannel) => {
    if (!channelList) return;

    if (![...channelList.children].some(li => extractChannelName(li.textContent) === newChannel)) {
      const li = document.createElement('li');
      li.classList.add('channel');
      const emoji = channelEmojis[newChannel] || "🆕";
      li.textContent = `# ${emoji} ┊ ${newChannel} (0)`;

      li.addEventListener('click', () => {
        const clickedRoom = extractChannelName(li.textContent);
        if (clickedRoom === currentChannel) return;
        currentChannel = clickedRoom;
        localStorage.setItem('currentChannel', currentChannel);
        if (chatMessages) chatMessages.innerHTML = '';
        selectChannelInUI(currentChannel);
        socket.emit('joinRoom', currentChannel);
      });

      channelList.appendChild(li);
    }
    showBanner(`Salon "${newChannel}" créé avec succès !`, 'success');
  });

  socket.on('roomUserCounts', (counts) => {
    if (!channelList) return;

    [...channelList.children].forEach(li => {
      const name = extractChannelName(li.textContent);
      if (name && counts[name] !== undefined) {
        li.textContent = li.textContent.replace(/\s*\(\d+\)$/, '').trim();
        const emoji = channelEmojis[name] || "💬";

        // Ne pas afficher le nombre si mode invisible est activé et c'est le salon courant
        if (invisibleMode && name === currentChannel) {
          li.textContent = `# ${emoji} ┊ ${name}`;
        } else {
          li.textContent = `# ${emoji} ┊ ${name} (${counts[name]})`;
        }
      }
    });
  });

  socket.on('room list', (rooms) => {
    if (!channelList) return;
    const previousChannel = currentChannel;

    channelList.innerHTML = '';

    rooms.forEach(channelName => {
      const li = document.createElement('li');
      li.classList.add('channel');
      const emoji = channelEmojis[channelName] || "💬";
      li.textContent = `# ${emoji} ┊ ${channelName} (0)`;

      li.addEventListener('click', () => {
        const clickedRoom = extractChannelName(li.textContent);
        if (clickedRoom === currentChannel) return;
        currentChannel = clickedRoom;
        localStorage.setItem('currentChannel', currentChannel);
        if (chatMessages) chatMessages.innerHTML = '';
        selectChannelInUI(currentChannel);
        socket.emit('joinRoom', currentChannel);
      });

      channelList.appendChild(li);
    });

    if (!rooms.includes(previousChannel)) {
      currentChannel = 'Général';
      localStorage.setItem('currentChannel', currentChannel);
      socket.emit('joinRoom', currentChannel);
      if (chatMessages) chatMessages.innerHTML = '';
    }

    selectChannelInUI(currentChannel);
  });

  // Ping périodique
  setInterval(() => {
    socket.emit('ping');
  }, 10000);

  // Gestion clic création salon
  if (createChannelButton) {
    createChannelButton.addEventListener('click', () => {
      if (!newChannelNameInput) return;
      const newRoom = newChannelNameInput.value.trim();
            if (!newRoom || newRoom.length > 20 || /\s/.test(newRoom)) {
        showBanner('Nom de salon invalide. Pas d’espaces, max 20 caractères.', 'error');
        return;
      }
      socket.emit('createRoom', newRoom);
      newChannelNameInput.value = '';
    });
  }

  // Bouton mode invisible toggle (visible uniquement aux admins)
  if (invisibleBtn) {
    invisibleBtn.addEventListener('click', () => {
      invisibleMode = !invisibleMode;
      localStorage.setItem('invisibleMode', invisibleMode);
      updateInvisibleButton();

      socket.emit('toggleInvisible', invisibleMode);
      showBanner(`Mode invisible ${invisibleMode ? 'activé' : 'désactivé'}.`, 'success');
    });
  }

  // Soumission formulaire pseudo via bouton ou Enter
  if (usernameSubmitBtn) {
    usernameSubmitBtn.addEventListener('click', submitUserInfo);
  }
  if (usernameInput) {
    usernameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitUserInfo();
    });
  }
  if (passwordInput) {
    passwordInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitUserInfo();
    });
  }

  // Envoi message via Enter
  if (messageInput) {
    messageInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Bouton emoji
  if (emojiButton && emojiPicker) {
    emojiButton.addEventListener('click', () => {
      emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
    });

    // Remplir emojiPicker avec emojis simples
    const emojis = ['😀','😂','😍','👍','🎉','💬','❤️','😢','😡','😎','🎮','🎧','🌿'];
    emojis.forEach(emoji => {
      const span = document.createElement('span');
      span.textContent = emoji;
      span.style.cursor = 'pointer';
      span.style.margin = '2px';
      span.style.fontSize = '20px';
      span.addEventListener('click', () => {
        if (messageInput) {
          messageInput.value += emoji;
          messageInput.focus();
          emojiPicker.style.display = 'none';
        }
      });
      emojiPicker.appendChild(span);
    });
  }

  // Demande au serveur la liste des salons à l'initialisation
  socket.emit('getRooms');

});

