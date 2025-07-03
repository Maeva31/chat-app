export function initInvisibleMode() {
  const invisibleBtn = document.getElementById('toggle-invisible-btn');

  if (!invisibleBtn) return;

  let invisibleMode = localStorage.getItem('invisibleMode') === 'true';

  function updateInvisibleButton() {
    invisibleBtn.textContent = `👻`;
    invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
    invisibleBtn.title = invisibleMode ? 'Mode invisible activé' : 'Mode invisible désactivé';
    invisibleBtn.style.padding = '6px 10px';
  }

  invisibleBtn.addEventListener('click', () => {
    invisibleMode = !invisibleMode;
    localStorage.setItem('invisibleMode', invisibleMode);
    updateInvisibleButton();
    if (window.socket && window.socket.connected) {
      window.socket.emit('toggle invisible', invisibleMode);
    }
  });

  // Affiche bouton uniquement si admin
  const username = localStorage.getItem('username');
  if (!username || username !== 'MaEvA') {
    invisibleBtn.style.display = 'none';
  } else {
    invisibleBtn.style.display = 'inline-block';
    updateInvisibleButton();
  }
}
