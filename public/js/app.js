document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  const adminUsernames = ['MaEvA'];
  const modoUsernames = ['DarkGirL'];

  let selectedUser = null;
  let hasSentUserInfo = false;
  let initialLoadComplete = false;
  let bannerTimeoutId = null;

  let currentChannel = 'Général';  // Forcer le salon Général au chargement

  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');

  if (usernameInput && passwordInput) {
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim(); // ❌ retirer .toLowerCase()
      if (adminUsernames.includes(val) || modoUsernames.includes(val)) {
        passwordInput.style.display = 'block'; // afficher le mot de passe
      } else {
        passwordInput.style.display = 'none';  // cacher sinon
        passwordInput.value = '';              // vider le mot de passe
      }
    });

    const initialUsername = usernameInput.value.trim();
    if (adminUsernames.includes(initialUsername) || modoUsernames.includes(initialUsername)) {
      passwordInput.style.display = 'block';
    }
  }

  // Affiche la modal si pas de pseudo
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
    document.getElementById('myModal').style.display = 'block';
  }

  // Clic sur un salon dans la liste
  const channelListElem = document.getElementById('channel-list');
  if (channelListElem) {
    channelListElem.addEventListener('click', (e) => {
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

  // Envoi message avec touche Entrée
  const messageInputElem = document.getElementById('message-input');
  if (messageInputElem) {
    messageInputElem.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Création nouveau salon
  const createChannelBtn = document.getElementById('create-channel-button');
  if (createChannelBtn) {
    createChannelBtn.addEventListener('click', () => {
      const input = document.getElementById('new-channel-name');
      if (!input) return;
      const newRoom = input.value.trim();
      if (!newRoom || newRoom.length > 20 || /\s/.test(newRoom)) {
        showBanner("Nom de salon invalide : pas d'espaces, max 20 caractères.", 'error');
        return;
      }
      socket.emit('createRoom', newRoom);
      input.value = '';
      input.focus();
    });
  }

  socket.on('connect', () => {
    const savedUsername = localStorage.getItem('username');
    const savedGender = localStorage.getItem('gender');
    const savedAge = localStorage.getItem('age');
    const savedPassword = localStorage.getItem('password'); // <-- ajout

    if (!hasSentUserInfo && savedUsername && savedAge) {
      socket.emit('set username', {
        username: savedUsername,
        gender: savedGender || 'non spécifié',
        age: savedAge,
        invisible: invisibleMode,
        password: savedPassword || ''  // <-- ajout
      });
      currentChannel = 'Général';
      localStorage.setItem('currentChannel', currentChannel);
      socket.emit('joinRoom', currentChannel);
      selectChannelInUI(currentChannel);

      hasSentUserInfo = true;
      initialLoadComplete = true;

      if (invisibleMode) {
        showBanner('Mode invisible activé (auto)', 'success');
      }
    }
  });

  // Bouton validation pseudo
  const usernameSubmitBtn = document.getElementById('username-submit');
  if (usernameSubmitBtn) {
    usernameSubmitBtn.addEventListener('click', submitUserInfo);
  }

});
