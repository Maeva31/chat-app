// Affiche une bannière temporaire (type = 'error' ou 'success')
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

// Sélectionne visuellement un salon dans la liste
function selectChannelInUI(channelName) {
  document.querySelectorAll('.channel').forEach(c => {
    if (extractChannelName(c.textContent) === channelName) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
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
      <span class="role-icon"></span> 
      <div class="gender-square" style="background-color: ${getUsernameColor(gender)}">${age}</div>
      <span class="username-span clickable-username" style="color: ${color}" title="${role === 'admin' ? 'Admin' : role === 'modo' ? 'Modérateur' : ''}">${username}</span>
    `;

    const roleIconSpan = li.querySelector('.role-icon');
    if (role === 'admin') {
      const icon = document.createElement('img');
      icon.src = '/favicon.ico'; // ou ton icône admin
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
      selectedUser = username;
    });

    userList.appendChild(li);
  });
}

// Ouverture/fermeture de la modal de déconnexion
const logoutButton = document.getElementById('logoutButton');
const logoutModal = document.getElementById('logoutModal');
const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
const logoutCancelBtn = document.getElementById('logoutCancelBtn');

function openLogoutModal() {
  if (logoutModal) {
    logoutModal.style.display = 'flex';
  }
}

function closeLogoutModal() {
  if (logoutModal) {
    logoutModal.style.display = 'none';
  }
}

function performLogout() {
  socket.emit('logout');
  ['username', 'gender', 'age', 'password', 'invisibleMode', 'currentChannel'].forEach(key => {
    localStorage.removeItem(key);
  });
  location.reload();
}

if (logoutButton) {
  logoutButton.addEventListener('click', openLogoutModal);
}
if (logoutConfirmBtn) {
  logoutConfirmBtn.addEventListener('click', () => {
    closeLogoutModal();
    performLogout();
  });
}
if (logoutCancelBtn) {
  logoutCancelBtn.addEventListener('click', closeLogoutModal);
}
if (logoutModal) {
  logoutModal.addEventListener('click', e => {
    if (e.target === logoutModal) {
      closeLogoutModal();
    }
  });
}
