export function setupLogout(socket) {
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
    socket.emit('logout');
    ['username', 'gender', 'age', 'password', 'invisibleMode', 'currentChannel'].forEach(key => {
      localStorage.removeItem(key);
    });
    location.reload();
  }

  if (logoutButton) logoutButton.addEventListener('click', openLogoutModal);
  if (logoutConfirmBtn) logoutConfirmBtn.addEventListener('click', () => {
    closeLogoutModal();
    performLogout();
  });
  if (logoutCancelBtn) logoutCancelBtn.addEventListener('click', closeLogoutModal);
  if (logoutModal) logoutModal.addEventListener('click', e => {
    if (e.target === logoutModal) closeLogoutModal();
  });
}
