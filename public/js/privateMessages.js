// public/js/privateMessages.js
export default function setupPrivateMessaging(socket) {
  const tabsContainer = document.getElementById('chat-tabs');
  const publicMessages = document.getElementById('chat-messages');
  const privateMessagesContainer = document.getElementById('private-messages');
  const input = document.getElementById('message-input');

  const privateConversations = {}; // { username: [ {message, fromSelf} ] }
  let activeTab = 'public';

  function createTab(username) {
    const tab = document.createElement('button');
    tab.textContent = `@${username}`;
    tab.className = 'tab';
    tab.dataset.user = username;
    tab.addEventListener('click', () => {
      switchToTab(username);
    });
    tabsContainer.appendChild(tab);
  }

  function switchToTab(username) {
    activeTab = username;
    [...tabsContainer.children].forEach(tab => {
      tab.classList.toggle('active', tab.dataset.user === username);
    });

    if (username === 'public') {
      publicMessages.style.display = 'block';
      privateMessagesContainer.style.display = 'none';
    } else {
      publicMessages.style.display = 'none';
      privateMessagesContainer.style.display = 'block';
      renderPrivateMessages(username);
    }
  }

  function renderPrivateMessages(username) {
    privateMessagesContainer.innerHTML = '';
    const messages = privateConversations[username] || [];
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'message';
      div.textContent = msg.fromSelf ? `Vous : ${msg.text}` : `${username} : ${msg.text}`;
      privateMessagesContainer.appendChild(div);
    });
    privateMessagesContainer.scrollTop = privateMessagesContainer.scrollHeight;
  }

  function openPrivateConversation(username) {
    if (!privateConversations[username]) {
      privateConversations[username] = [];
      createTab(username);
    }
    switchToTab(username);
  }

  function addPrivateMessage(username, text, fromSelf) {
    if (!privateConversations[username]) {
      privateConversations[username] = [];
      createTab(username);
    }
    privateConversations[username].push({ text, fromSelf });
    if (activeTab === username) renderPrivateMessages(username);
  }

  // Double clic sur pseudo
  document.getElementById('users').addEventListener('dblclick', (e) => {
    const span = e.target.closest('.username-span');
    if (span) {
      const targetUser = span.textContent.trim();
      openPrivateConversation(targetUser);
    }
  });

  // Réception message privé
  socket.on('private message', ({ from, message }) => {
    addPrivateMessage(from, message, false);
  });

  // Envoi message
  function sendPrivateMessage(to, message) {
    socket.emit('private message', { to, message });
    addPrivateMessage(to, message, true);
  }

  // Surcharge globale de `sendMessage()` si on est sur MP
  const originalSendMessage = window.sendMessage;
  window.sendMessage = function () {
    const msg = input.value.trim();
    if (!msg) return;
    if (activeTab === 'public') {
      originalSendMessage();
    } else {
      sendPrivateMessage(activeTab, msg);
      input.value = '';
    }
  };

  // Ajoute aussi un onglet pour le salon public
  const publicTab = document.createElement('button');
  publicTab.textContent = '💬 Général';
  publicTab.className = 'tab active';
  publicTab.dataset.user = 'public';
  publicTab.addEventListener('click', () => switchToTab('public'));
  tabsContainer.appendChild(publicTab);
}
