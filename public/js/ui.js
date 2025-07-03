import { extractChannelName, showBanner } from './chatUtils.js';

export function initUI() {
  const adminUsernames = ['MaEvA'];
  const modoUsernames = ['DarkGirL'];

  // Inputs pseudo + password
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');

  if (usernameInput && passwordInput) {
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      if (adminUsernames.includes(val) || modoUsernames.includes(val)) {
        passwordInput.style.display = 'block';
      } else {
        passwordInput.style.display = 'none';
        passwordInput.value = '';
      }
    });

    const initialUsername = usernameInput.value.trim();
    if (adminUsernames.includes(initialUsername) || modoUsernames.includes(initialUsername)) {
      passwordInput.style.display = 'block';
    }
  }

  // Modal pseudo si pas de pseudo
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
    const modal = document.getElementById('myModal');
    if (modal) modal.style.display = 'block';
  }

  // Gestion création salon
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
      window.socket.emit('createRoom', newRoom);
      input.value = '';
      input.focus();
    });
  }

  // Gestion clic salon (delegation)
  const channelList = document.getElementById('channel-list');
  if (channelList) {
    channelList.addEventListener('click', e => {
      const target = e.target.closest('.channel');
      if (!target) return;
      const clickedChannel = extractChannelName(target.textContent);
      if (!clickedChannel || clickedChannel === window.currentChannel) return;
      window.currentChannel = clickedChannel;
      localStorage.setItem('currentChannel', window.currentChannel);
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';
      // Emission joinRoom via socketHandlers.js
      window.socket.emit('joinRoom', window.currentChannel);
    });
  }

  // Gestion bouton logout
  const logoutButton = document.getElementById('logoutButton');
  const logoutModal = document.getElementById('logoutModal');
  const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
  const logoutCancelBtn = document.getElementById('logoutCancelBtn');

  function openLogoutModal() {
    if (logoutModal) logoutModal.style.display = 'flex';
  }
  function closeLogoutModal() {
    if (logoutModal) logoutModal.style.display = 'none';
  }
  function performLogout() {
    window.socket.emit('logout');
    ['username', 'gender', 'age', 'password', 'invisibleMode', 'currentChannel'].forEach(k => localStorage.removeItem(k));
    location.reload();
  }

  if (logoutButton) logoutButton.addEventListener('click', openLogoutModal);
  if (logoutConfirmBtn) logoutConfirmBtn.addEventListener('click', () => { closeLogoutModal(); performLogout(); });
  if (logoutCancelBtn) logoutCancelBtn.addEventListener('click', closeLogoutModal);
  if (logoutModal) logoutModal.addEventListener('click', e => { if (e.target === logoutModal) closeLogoutModal(); });
}
