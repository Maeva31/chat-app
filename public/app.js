document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  // Variables globales
  let selectedUser = null;
  let hasSentUserInfo = false;
  let initialLoadComplete = false;
  let bannerTimeoutId = null;
  let invisibleMode = localStorage.getItem('invisibleMode') === 'true';
  let isAdmin = false;
  let currentChannel = localStorage.getItem('currentChannel') || 'Général';

  // DOM Elements
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');
  const invisibleBtn = document.getElementById('toggle-invisible-btn');
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

  // --- Gestion affichage champ mot de passe selon pseudo ---
  if (usernameInput && passwordInput) {
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      if (['admin', 'modo', 'MaEvA'].includes(val)) {
        passwordInput.style.display = 'block';
      } else {
        passwordInput.style.display = 'none';
        passwordInput.value = '';
      }
    });
  }

  // --- Affichage modal connexion si pas de pseudo enregistré ---
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
    document.getElementById('myModal').style.display = 'block';
  } else {
    document.getElementById('chat-wrapper').style.display = 'block';
  }

  // --- Fonction de soumission des infos utilisateur ---
  function submitUserInfo() {
    const genderSelect = document.getElementById('gender-select');
    const ageInput = document.getElementById('age-input');
    const modalError = document.getElementById('modal-error');
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

    // Sauvegarde localStorage
    localStorage.setItem('username', username);
    localStorage.setItem('gender', gender);
    localStorage.setItem('age', age.toString());
    localStorage.setItem('password', password);
  }

  // --- Gestion réponse serveur 'username accepted' ---
  socket.once('username accepted', ({ username, gender, age }) => {
    document.getElementById('myModal').style.display = 'none';
    document.getElementById('chat-wrapper').style.display = 'block';

    hasSentUserInfo = true;
    initialLoadComplete = true;

    currentChannel = localStorage.getItem('currentChannel') || 'Général';
    socket.emit('joinRoom', currentChannel);
    selectChannelInUI(currentChannel);
  });

  // --- Mise à jour du bouton mode invisible ---
  function updateInvisibleButton() {
    if (!invisibleBtn) return;
    invisibleBtn.textContent = `👻 Mode Invisible`;
    invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
  }

  // --- Affichage bouton mode invisible si activé et si admin ---
  if (invisibleBtn) {
    if (invisibleMode) {
      invisibleBtn.style.display = 'inline-block';
      updateInvisibleButton();
    } else {
      invisibleBtn.style.display = 'none';
    }
  }

  // --- Affiche une bannière temporaire ---
  function showBanner(message, type = 'error') {
    if (!initialLoadComplete) return;
    const banner = document.getElementById('error-banner');
    const text = document.getElementById('error-banner-text');
    if (!banner || !text) return;

    const prefix = type === 'success' ? '✅' : '❌';
    text.textContent = `${prefix} ${message}`;
    banner.style.display = 'flex';
    banner.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';

    if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
      banner.style.display = 'none';
      bannerTimeoutId = null;
    }, 5000);
  }

  // --- Couleur selon genre ---
  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // --- Extraction nom canal depuis texte ---
  function extractChannelName(text) {
    text = text.replace(/\s*\(\d+\)$/, '').trim();
    const parts = text.split('┊');
    if (parts.length > 1) return parts[1].trim();
    return text.replace(/^#?\s*[\p{L}\p{N}\p{S}\p{P}\s]*/u, '').trim();
  }

  // --- Mise à jour de la liste des utilisateurs ---
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
        const input = document.getElementById('message-input');
        const mention = `@${username} `;
        if (!input.value.includes(mention)) input.value = mention + input.value;
        input.focus();
        selectedUser = username;
      });

      userList.appendChild(li);
    });
  }

  // --- Ajoute un message dans la zone de chat ---
  function addMessageToChat(msg) {
    // Filtrage des messages système hors salon courant
    if (msg.username === 'Système') {
      const salonRegex = /salon\s+(.+)$/i;
      const match = salonRegex.exec(msg.message);
      if (match && match[1]) {
        const salonDuMessage = match[1].trim();
        if (salonDuMessage !== currentChannel) {
          return;
        }
      }
    }

    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;

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
        const input = document.getElementById('message-input');
        const mention = `@${msg.username} `;
        if (!input.value.includes(mention)) input.value = mention + input.value;
        input.focus();
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

  // --- Sélection visuelle d’un salon dans l’UI ---
  function selectChannelInUI(channelName) {
    document.querySelectorAll('.channel').forEach(c => {
      if (extractChannelName(c.textContent) === channelName) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  }

  // --- Gestion join salon côté serveur ---
  socket.on('joinedRoom', (newChannel) => {
    currentChannel = newChannel;
    localStorage.setItem('currentChannel', newChannel);
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    selectChannelInUI(newChannel);
    selectedUser = null;
    socket.emit('request history', newChannel);
  });

  // --- Clic sur salon dans la liste ---
  const channelList = document.getElementById('channel-list');
  if (channelList) {
    channelList.addEventListener('click', (e) => {
      const target = e.target.closest('.channel');
      if (!target) return;
      const clickedChannel = extractChannelName(target.textContent);
      if (!clickedChannel || clickedChannel === currentChannel) return;

      currentChannel = clickedChannel;
      localStorage.setItem('currentChannel', currentChannel);
      socket.emit('joinRoom', currentChannel);
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';
      selectChannelInUI(currentChannel);
      selectedUser = null;
    });
  }

  // --- Envoi message ---
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
      });
      input.value = '';
    }
  }

  // --- Évènements socket pour gestion divers ---
  socket.on('username error', msg => showBanner(msg, 'error'));
  socket.on('username exists', (username) => {
    const modalError = document.getElementById('modal-error');
    if (!modalError) return;
    modalError.textContent = `❌ Le nom "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = 'block';
  });

  socket.on('chat history', (messages) => {
    const chatMessages = document.getElementById('chat-messages');
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

  socket.on('user list', (users) => {
    updateUserList(users);

    // Mise à jour bouton invisible selon rôle
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
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) chatMessages.innerHTML = '';
        selectChannelInUI(currentChannel);
        socket.emit('joinRoom', currentChannel);
      });
      channelList.appendChild(li);
    }

    // Rejoindre automatiquement le nouveau salon
    currentChannel = newChannel;
    localStorage.setItem('currentChannel', currentChannel);
    socket.emit('joinRoom', currentChannel);
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) chatMessages.innerHTML = '';
    selectChannelInUI(currentChannel);

    showBanner(`Salon "${newChannel}" créé et rejoint avec succès !`, 'success');
  });

  socket.on('roomUserCounts', (counts) => {
    if (!channelList) return;

    [...channelList.children].forEach(li => {
      const name = extractChannelName(li.textContent);
      if (name && counts[name] !== undefined) {
        li.textContent = li.textContent.replace(/\s*\(\d+\)$/, '').trim();
        const emoji = channelEmojis[name] || "💬";

        // Ne pas afficher le nombre si mode invisible activé et salon courant
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
        const chatMessages = document.getElementById('chat-messages');
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
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';
    }

    selectChannelInUI(currentChannel);
  });

  // --- Ping périodique pour keep-alive ---
  setInterval(() => {
    socket.emit('ping');
  }, 10000);

  // --- Création nouveau salon ---
  const createChannelBtn = document.getElementById('create-channel-button');
  if (createChannelBtn) {
    createChannelBtn.addEventListener('click', () => {
      const input = document.getElementById('new-channel-name');
      if (!input) return;
      const newRoom = input.value.trim();
      if (!newRoom) return showBanner('Le nom du salon ne peut pas être vide.', 'error');
      if (newRoom.length > 30) return showBanner('Le nom du salon est trop long.', 'error');

      socket.emit('createRoom', newRoom);
      input.value = '';
    });
  }

  // --- Bouton toggle mode invisible ---
  if (invisibleBtn) {
    invisibleBtn.addEventListener('click', () => {
      invisibleMode = !invisibleMode;
      localStorage.setItem('invisibleMode', invisibleMode.toString());
      socket.emit('toggle invisible', invisibleMode);
      updateInvisibleButton();
      if (invisibleMode) {
        showBanner('Mode invisible activé', 'success');
      } else {
        showBanner('Mode invisible désactivé', 'success');
      }
    });
  }

  // --- Soumission formulaire de connexion ---
  const userInfoForm = document.getElementById('user-info-form');
  if (userInfoForm) {
    userInfoForm.addEventListener('submit', e => {
      e.preventDefault();
      submitUserInfo();
    });
  }

  // --- Soumission message (via bouton ou touche Entrée) ---
  const sendMessageBtn = document.getElementById('send-message-btn');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendMessage);
  }
  const messageInput = document.getElementById('message-input');
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // --- Gestion de la reconnexion automatique ---
  socket.on('disconnect', () => {
    showBanner('Déconnecté du serveur, tentative de reconnexion...', 'error');
  });
  socket.on('connect', () => {
    showBanner('Connecté au serveur.', 'success');
    // Ré-envoi infos si besoin
    if (!hasSentUserInfo) {
      const savedUsername = localStorage.getItem('username');
      const savedGender = localStorage.getItem('gender');
      const savedAge = localStorage.getItem('age');
      const savedPassword = localStorage.getItem('password') || '';
      if (savedUsername && savedAge) {
        socket.emit('set username', {
          username: savedUsername,
          gender: savedGender || 'non spécifié',
          age: savedAge,
          invisible: invisibleMode,
          password: savedPassword
        });
        socket.emit('joinRoom', currentChannel);
        selectChannelInUI(currentChannel);
        hasSentUserInfo = true;
        initialLoadComplete = true;
      }
    } else {
      socket.emit('joinRoom', currentChannel);
    }
  });
});
