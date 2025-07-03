import { extractChannelName, showBanner } from './chatUtils.js';

export function initUI() {
  const adminUsernames = ['MaEvA'];
  const modoUsernames = ['DarkGirL'];

  // Inputs pseudo + password + autres champs
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');
  const genderSelect = document.getElementById('gender-select');
  const ageInput = document.getElementById('age-input');
  const submitBtn = document.getElementById('username-submit');
  const modalError = document.getElementById('modal-error');
  const modal = document.getElementById('myModal');

  // Fonction pour afficher ou cacher le champ mot de passe selon le pseudo
  function updatePasswordFieldVisibility(username) {
    if (adminUsernames.includes(username) || modoUsernames.includes(username)) {
      passwordInput.style.display = 'block';
    } else {
      passwordInput.style.display = 'none';
      passwordInput.value = '';
      localStorage.removeItem('password');
    }
  }

  if (usernameInput && passwordInput) {
    // Restaurer mot de passe sauvegardé
    const savedPassword = localStorage.getItem('password') || '';
    passwordInput.value = savedPassword;

    // Restaurer pseudo sauvegardé, le mettre dans le champ et adapter visibilité mot de passe
    const savedUsername = localStorage.getItem('username') || '';
    usernameInput.value = savedUsername;
    updatePasswordFieldVisibility(savedUsername);

    // Quand on modifie le pseudo, adapter la visibilité du mot de passe
    usernameInput.addEventListener('input', () => {
      const val = usernameInput.value.trim();
      updatePasswordFieldVisibility(val);
    });

    // Sauvegarder le mot de passe à chaque changement
    passwordInput.addEventListener('input', () => {
      localStorage.setItem('password', passwordInput.value);
    });
  }

  // Gestion clic sur bouton "Valider" dans modal
  if (submitBtn && usernameInput && genderSelect && ageInput && passwordInput && modalError && modal) {
    submitBtn.addEventListener('click', () => {
      modalError.style.display = 'none';
      modalError.textContent = '';

      const username = usernameInput.value.trim();
      const gender = genderSelect.value || 'non spécifié';
      const age = parseInt(ageInput.value, 10);
      const password = passwordInput.value || '';

      if (!username) {
        modalError.textContent = 'Veuillez saisir un pseudo.';
        modalError.style.display = 'block';
        return;
      }
      if (username.length > 16) {
        modalError.textContent = 'Le pseudo ne doit pas dépasser 16 caractères.';
        modalError.style.display = 'block';
        return;
      }
      if (!age || isNaN(age) || age < 18 || age > 89) {
        modalError.textContent = 'Veuillez saisir un âge valide entre 18 et 89 ans.';
        modalError.style.display = 'block';
        return;
      }

      if (!window.socket) {
        modalError.textContent = 'Connexion au serveur indisponible.';
        modalError.style.display = 'block';
        return;
      }

      // Sauvegarder pseudo, mot de passe, genre, age dans localStorage
      localStorage.setItem('username', username);
      localStorage.setItem('password', password);
      localStorage.setItem('gender', gender);
      localStorage.setItem('age', age);

      window.socket.emit('set username', {
        username,
        gender,
        age,
        invisible: false,
        password
      });
    });
  }

  // Modal pseudo si pas de pseudo enregistré
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
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

      const text = target.textContent;
      if (typeof text !== 'string' || !text.trim()) {
        console.warn('Channel click with invalid textContent:', text);
        return;
      }

      const clickedChannel = extractChannelName(text);
      if (!clickedChannel || clickedChannel === window.currentChannel) return;

      window.currentChannel = clickedChannel;
      localStorage.setItem('currentChannel', window.currentChannel);

      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';

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
