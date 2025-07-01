export function updateInvisibleButton(invisibleBtn, invisibleMode) {
  if (!invisibleBtn) return;
  invisibleBtn.textContent = `👻 Mode Invisible`;
  invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
}

export function setupInvisibleToggle(socket, invisibleBtn, invisibleMode, isAdmin, showBanner) {
  if (!invisibleBtn) return;
  invisibleBtn.addEventListener('click', () => {
    invisibleMode = !invisibleMode;
    updateInvisibleButton(invisibleBtn, invisibleMode);
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
