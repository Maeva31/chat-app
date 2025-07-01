import { adminUsernames, modoUsernames, handlePasswordFieldDisplay, submitUserInfo } from './userManagement.js';
import { addMessageToChat, updateUserList, showBanner, getUsernameColor } from './chatUI.js';
import { extractChannelName, channelEmojis } from './channels.js';
import { updateInvisibleButton, setupInvisibleToggle } from './invisibleMode.js';
import { setupLogout } from './logout.js';

document.addEventListener('DOMContentLoaded', () => {
  const socket = io();

  window.currentChannel = 'Général';  // Forcer le salon Général au chargement
  let hasSentUserInfo = false;
  let initialLoadComplete = false;
  let invisibleMode = localStorage.getItem('invisibleMode') === 'true' || false;
  let isAdmin = false;
  
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');

  if (usernameInput && passwordInput) {
    handlePasswordFieldDisplay(usernameInput, passwordInput);
  }

  setupLogout(socket);

  const invisibleBtn = document.getElementById('toggle-invisible-btn');
  if (invisibleBtn) {
    if (invisibleMode) {
      invisibleBtn.style.display = 'inline-block';
      updateInvisibleButton(invisibleBtn, invisibleMode);
    } else {
      invisibleBtn.style.display = 'none';
    }

    setupInvisibleToggle(socket, invisibleBtn, invisibleMode, isAdmin, showBanner);
  }

  document.getElementById('username-submit').addEventListener('click', () => submitUserInfo(socket, invisibleMode));

  socket.on('username accepted', ({ username, gender, age }) => {
    localStorage.setItem('username', username);
    localStorage.setItem('gender', gender);
    localStorage.setItem('age', age);

    document.getElementById('myModal').style.display = 'none';
    document.getElementById('chat-wrapper').style.display = 'block';

    socket.emit('joinRoom', window.currentChannel);
    selectChannelInUI(window.currentChannel);

    hasSentUserInfo = true;
    initialLoadComplete = true;

    if (adminUsernames.includes(username)) {
      isAdmin = true;
      invisibleMode = localStorage.getItem('invisibleMode') === 'true';
      if (invisibleBtn) {
        invisibleBtn.style.display = 'inline-block';
        updateInvisibleButton(invisibleBtn, invisibleMode);
      }
    } else {
      isAdmin = false;
      if (!invisibleMode && invisibleBtn) {
        invisibleBtn.style.display = 'none';
      }
    }
  });

  socket.on('chat message', addMessageToChat);
  socket.on('user list', updateUserList);
  socket.on('error message', msg => showBanner(`❗ ${msg}`, 'error'));
  socket.on('no permission', () => showBanner("Vous n'avez pas les droits pour utiliser les commandes.", "error"));
});
