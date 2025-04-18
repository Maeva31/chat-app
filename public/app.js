document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  let selectedUser = null;
  let currentChannel = 'Général';

  const genderColors = {
    Homme: '#00f',
    Femme: '#f0f',
    Autre: '#0ff',
    default: '#aaa'
  };

  // --- Fonctions utilitaires ---
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
    setTimeout(() => {
      errorBox.style.display = "none";
    }, 4000);
  }

  // --- Mise à jour de la liste des utilisateurs ---
  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';

    if (!Array.isArray(users)) {
      console.error("La liste des utilisateurs n'est pas un tableau.");
      return;
    }

    users.forEach(user => {
      const username = user?.username || 'Inconnu';
      const age = user?.age || '?';
      const gender = user?.gender || 'Non spécifié';

      const li = document.createElement('li');
      li.classList.add('user-item');
      li.innerHTML = `
        <div class="gender-square" style="background-color: ${getGenderColor(gender)}">${age}</div>
        <span class="username-span" style="color: ${getUsernameColor(gender)}">${username}</span>
      `;

      userList.appendChild(li);
    });
  }

  socket.on('user list', updateUserList);

  // --- Historique et réception des messages ---
  socket.on('chat history', function (messages) {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = '';
    messages.forEach(msg => addMessageToChat(msg, chatMessages));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('chat message', function (msg) {
    const chatMessages = document.getElementById("chat-messages");
    addMessageToChat(msg, chatMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  function addMessageToChat(msg, chatMessages) {
    const newMessage = document.createElement("div");
    const date = new Date(msg.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("clickable-username");
    usernameSpan.style.color = getUsernameColor(msg.gender);
    usernameSpan.textContent = msg.username || 'Inconnu';

    usernameSpan.addEventListener("click", function () {
      const messageInput = document.getElementById("message-input");
      const current = messageInput.value.trim();
      const mention = `@${msg.username} `;
      if (!current.includes(mention)) {
        messageInput.value = mention + current;
      }
      messageInput.focus();
      selectedUser = msg.username;
    });

    newMessage.innerHTML = `[${timeString}] `;
    newMessage.appendChild(usernameSpan);
    newMessage.insertAdjacentHTML("beforeend", `: ${msg.message}`);
    newMessage.classList.add("message");
    newMessage.dataset.username = msg.username;

    chatMessages.appendChild(newMessage);
  }

  // --- Envoi de message ---
  function sendMessage() {
    const messageInput = document.getElementById("message-input");
    const message = messageInput.value.trim();
    const username = localStorage.getItem("username");

    if (!message) return showErrorMessage("Vous ne pouvez pas envoyer de message vide.");
    if (message.length > 300) return showErrorMessage("Message trop long (300 caractères max).");

    if (username) {
      socket.emit('chat message', {
        username,
        message,
        timestamp: new Date().toISOString(),
        channel: currentChannel
      });
      messageInput.value = "";
    }
  }

  document.getElementById("message-input").addEventListener("keypress", function (event) {
    if (event.key === "Enter") sendMessage();
  });

  // --- Gestion utilisateur depuis la modal ---
  function submitUserInfo() {
    const usernameInput = document.getElementById("username-input");
    const genderSelect = document.getElementById("gender-select");
    const ageInput = document.getElementById("age-input");
    const modalError = document.getElementById("modal-error");

    const username = usernameInput.value.trim();
    const gender = genderSelect.value;
    const age = parseInt(ageInput.value.trim(), 10);

    if (!username || username.includes(" ") || username.length > 16) {
      modalError.textContent = "❌ Le pseudo ne doit pas contenir d'espaces et doit faire 16 caractères max.";
      modalError.style.display = "block";
      return;
    }

    if (isNaN(age) || age < 18 || age > 89) {
      modalError.textContent = "❌ L'âge doit être un nombre entre 18 et 89.";
      modalError.style.display = "block";
      return;
    }

    if (!gender) {
      modalError.textContent = "❌ Veuillez sélectionner un genre.";
      modalError.style.display = "block";
      return;
    }

    modalError.style.display = "none";
    localStorage.setItem("username", username);
    localStorage.setItem("gender", gender);
    localStorage.setItem("age", age);

    socket.emit('set username', { username, gender, age });
    document.getElementById("myModal").style.display = "none";
  }

  document.getElementById("username-submit").addEventListener("click", submitUserInfo);

  socket.on('username exists', function (username) {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom d'utilisateur "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  socket.on('user data', (userData) => {
    document.getElementById('username').textContent = userData.username || 'Inconnu';
    document.getElementById('age').textContent = userData.age || 'Inconnu';
    document.getElementById('gender').textContent = userData.gender || 'Non spécifié';
  });

  // --- Gestion des salons ---
  function updateChannelList(roomName, userCount) {
    const channelElement = document.querySelector(`.channel[data-room="${roomName}"]`);
    if (channelElement) {
      const userCountSpan = channelElement.querySelector('.user-count');
      if (userCountSpan) userCountSpan.textContent = `(${userCount})`;
    }
  }

  socket.on('room created', function (newRoom) {
    const channelList = document.getElementById('channel-list');
    const li = document.createElement('li');
    li.classList.add('channel');
    li.dataset.room = newRoom;
    li.innerHTML = `# ${newRoom} <span class="user-count">(0)</span>`;

    li.addEventListener('click', () => {
      document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
      li.classList.add('selected');
      currentChannel = newRoom;
      socket.emit('joinRoom', newRoom);
      document.querySelector('#chat-messages').innerHTML = '';
      document.getElementById("message-input").value = '';
      selectedUser = null;
    });

    channelList.appendChild(li);
  });

  socket.on('user count', function ({ roomName, userCount }) {
    updateChannelList(roomName, userCount);
  });

  document.querySelectorAll('.channel').forEach(channel => {
    channel.addEventListener('click', () => {
      document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
      channel.classList.add('selected');
      currentChannel = channel.textContent.replace('# ', '');
      socket.emit('joinRoom', currentChannel);
      document.querySelector('#chat-messages').innerHTML = '';
      document.getElementById("message-input").value = '';
      selectedUser = null;
    });
  });

  // --- Chargement auto depuis localStorage ---
  const savedUsername = localStorage.getItem("username");
  const savedGender = localStorage.getItem("gender");
  const savedAge = localStorage.getItem("age");

  if (savedUsername && savedAge) {
    socket.emit('set username', {
      username: savedUsername,
      gender: savedGender || "non spécifié",
      age: savedAge
    });
    document.getElementById("myModal").style.display = "none";
  } else {
    document.getElementById("myModal").style.display = "block";
  }
});
