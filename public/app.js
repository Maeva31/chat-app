document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  let selectedUser = null;
  let currentChannel = 'Général';

  const genderColors = {
    Homme: '#00f',
    Femme: '#f0f',
    Autre: '#0ff',
    default: '#aaa'
  };

  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  function getGenderColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  function showErrorMessage(message) {
    const errorBox = document.getElementById("error-box");
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = "block";
    setTimeout(() => errorBox.style.display = "none", 4000);
  }

  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';
    if (!Array.isArray(users)) return;

    users
      .filter(user => user.channel === currentChannel) // 🔥 Affiche uniquement les utilisateurs du salon actif
      .forEach(user => {
        const li = document.createElement('li');
        li.classList.add('user-item');
        li.innerHTML = `  
          <div class="gender-square" style="background-color: ${getGenderColor(user.gender)}">${user.age}</div>
          <span class="username-span" style="color: ${getUsernameColor(user.gender)}">${user.username}</span>
        `;
        userList.appendChild(li);
      });
  }

  function submitUserInfo() {
    const username = document.getElementById("username-input").value.trim();
    const gender = document.getElementById("gender-select").value;
    const age = parseInt(document.getElementById("age-input").value.trim(), 10);
    const modalError = document.getElementById("modal-error");

    if (!username || username.includes(" ") || username.length > 16) {
      modalError.textContent = "❌ Le pseudo ne doit pas contenir d'espaces et faire max 16 caractères.";
      return modalError.style.display = "block";
    }

    if (isNaN(age) || age < 18 || age > 89) {
      modalError.textContent = "❌ L'âge doit être un nombre entre 18 et 89.";
      return modalError.style.display = "block";
    }

    if (!gender) {
      modalError.textContent = "❌ Veuillez sélectionner un genre.";
      return modalError.style.display = "block";
    }

    modalError.style.display = "none";
    localStorage.setItem("username", username);
    localStorage.setItem("gender", gender);
    localStorage.setItem("age", age);

    socket.emit('set username', { username, gender, age });
    document.getElementById("myModal").style.display = "none";
  }

  function addMessageToChat(msg, chatMessages) {
    const newMessage = document.createElement("div");
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("clickable-username");
    usernameSpan.style.color = getUsernameColor(msg.gender);
    usernameSpan.textContent = msg.username || 'Inconnu';

    usernameSpan.addEventListener("click", () => {
      const messageInput = document.getElementById("message-input");
      const mention = `@${msg.username} `;
      if (!messageInput.value.includes(mention)) {
        messageInput.value = mention + messageInput.value.trim();
      }
      messageInput.focus();
      selectedUser = msg.username;
    });

    newMessage.innerHTML = `[${time}] `;
    newMessage.appendChild(usernameSpan);
    newMessage.insertAdjacentHTML("beforeend", `: ${msg.message}`);
    newMessage.classList.add("message");
    newMessage.dataset.username = msg.username;

    chatMessages.appendChild(newMessage);
  }

  function sendMessage() {
    const messageInput = document.getElementById("message-input");
    const message = messageInput.value.trim();
    const username = localStorage.getItem("username");

    if (!message) return showErrorMessage("Message vide interdit.");
    if (message.length > 300) return showErrorMessage("Message trop long (max 300 caractères).");

    socket.emit('chat message', {
      username,
      message,
      timestamp: new Date().toISOString(),
      channel: currentChannel
    });

    messageInput.value = '';
  }

  socket.on('chat message', (msg) => {
    const chatMessages = document.getElementById('chat-messages');
    addMessageToChat(msg, chatMessages);
  });

  socket.on('username accepted', (username) => {
    document.getElementById("username-section").style.display = "none";
    document.getElementById("chat-section").style.display = "block";
  });

  socket.on('username exists', (username) => {
    showErrorMessage(`Le pseudo "${username}" est déjà pris !`);
  });

  socket.on('error', (errorMessage) => {
    showErrorMessage(errorMessage);
  });

  socket.on('user list', updateUserList);

  // Ajout d'écouteurs d'événements sur les boutons
  const sendButton = document.getElementById("send-button");
  const messageInput = document.getElementById("message-input");
  const createRoomButton = document.getElementById("create-room-button");
  const joinRoomButton = document.getElementById("join-room-button");

  if (sendButton) sendButton.addEventListener("click", sendMessage);
  if (messageInput) messageInput.addEventListener("keypress", (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  if (createRoomButton) createRoomButton.addEventListener("click", () => {
    const roomName = prompt("Entrez le nom du salon");
    socket.emit('createRoom', roomName);
  });

  if (joinRoomButton) joinRoomButton.addEventListener("click", () => {
    const roomName = prompt("Entrez le nom du salon à rejoindre");
    socket.emit('joinRoom', roomName);
  });

});
