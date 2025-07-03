// Variables pour mode invisible
const invisibleBtn = document.getElementById('toggle-invisible-btn');
let invisibleMode = localStorage.getItem('invisibleMode') === 'true' || false;
let isAdmin = false;

// Mets à jour le bouton (texte + couleur)
function updateInvisibleButton() {
  if (!invisibleBtn) return;
  invisibleBtn.textContent = `👻`;
  invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
  invisibleBtn.title = invisibleMode ? 'Mode invisible activé' : 'Mode invisible désactivé';
  invisibleBtn.style.padding = '6px 10px';
}

// Affichage initial du bouton invisible
if (invisibleBtn) {
  if (invisibleMode) {
    invisibleBtn.style.display = 'inline-block';
    updateInvisibleButton();
  } else {
    invisibleBtn.style.display = 'none';
  }
}

// Bascule du mode invisible au clic
if (invisibleBtn) {
  invisibleBtn.addEventListener('click', () => {
    invisibleMode = !invisibleMode;
    updateInvisibleButton();

    localStorage.setItem('invisibleMode', invisibleMode ? 'true' : 'false');

    if (invisibleMode) {
      socket.emit('chat message', { message: '/invisible on' });
      showBanner('Mode invisible activé', 'success');
      invisibleBtn.style.display = 'inline-block';
    } else {
      socket.emit('chat message', { message: '/invisible off' });
      showBanner('Mode invisible désactivé', 'success');
      if (!isAdmin) {
        invisibleBtn.style.display = 'none';
      }
    }
  });
}

// Mise à jour bouton mode invisible selon rôle (administrateur)
socket.on('user list', (users) => {
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
