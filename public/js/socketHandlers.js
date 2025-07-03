socket.on('joinedRoom', (newChannel) => {
  currentChannel = newChannel;
  localStorage.setItem('currentChannel', newChannel);
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) chatMessages.innerHTML = '';
  selectChannelInUI(newChannel);
  selectedUser = null;
  socket.emit('request history', newChannel);
});

socket.once('username accepted', ({ username, gender, age }) => {
  localStorage.setItem('username', username);
  localStorage.setItem('gender', gender);
  localStorage.setItem('age', age);

  document.getElementById('myModal').style.display = 'none';
  document.getElementById('chat-wrapper').style.display = 'block';

  socket.emit('joinRoom', currentChannel);
  selectChannelInUI(currentChannel);

  hasSentUserInfo = true;
  initialLoadComplete = true;
});

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

socket.on('user list', updateUserList);

socket.on('room created', (newChannel) => {
  const channelList = document.getElementById('channel-list');
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
  showBanner(`Salon "${newChannel}" créé avec succès !`, 'success');
});

socket.on('roomUserCounts', (counts) => {
  const channelList = document.getElementById('channel-list');
  if (!channelList) return;

  [...channelList.children].forEach(li => {
    const name = extractChannelName(li.textContent);
    if (name && counts[name] !== undefined) {
      const emoji = channelEmojis[name] || "💬";

      let countSpan = li.querySelector('.user-count');
      if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.classList.add('user-count');
        li.appendChild(countSpan);
      }

      if (invisibleMode && name === currentChannel) {
        countSpan.textContent = '';  // Pas de nombre si invisible
        li.firstChild.textContent = `# ${emoji} ┊ ${name} `;
      } else {
        countSpan.textContent = ` (${counts[name]})`;
        li.firstChild.textContent = `# ${emoji} ┊ ${name} `;
      }
    }
  });
});

socket.on('room list', (rooms) => {
  const channelList = document.getElementById('channel-list');
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

// Modération - Banni, kické, mute, unmute, erreurs, pas de permission
socket.on('banned', () => {
  showBanner('🚫 Vous avez été banni du serveur.', 'error');
  socket.disconnect();
});
socket.on('kicked', () => {
  showBanner('👢 Vous avez été expulsé du serveur.', 'error');
  socket.disconnect();
});
socket.on('muted', () => {
  showBanner('🔇 Vous avez été muté et ne pouvez plus envoyer de messages.', 'error');
});
socket.on('unmuted', () => {
  showBanner('🔊 Vous avez été unmuté, vous pouvez à nouveau envoyer des messages.', 'success');
});
socket.on('error message', (msg) => {
  showBanner(`❗ ${msg}`, 'error');
});
socket.on('no permission', () => {
  showBanner("Vous n'avez pas les droits pour utiliser les commandes.", "error");
});

// Redirection éventuelle
socket.on('redirect', (url) => {
  console.log('Redirect demandé vers:', url);
  if (typeof url === 'string' && url.length > 0) {
    window.location.href = url;
  }
});
