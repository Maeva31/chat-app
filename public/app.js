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

  // === 📦 UTILS ===
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

  // === 👥 UTILISATEURS ===
  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';
    if (!Array.isArray(users)) return console.error("Liste invalide.");

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

  // === 💬 MESSAGES ===
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
    messageInput.value = "";
  }

  // === 🔁 SOCKET EVENTS ===
  socket.on('chat history', (messages) => {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = '';
    messages.forEach(msg => addMessageToChat(msg, chatMessages));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('chat message', (msg) => {
    const chatMessages = document.getElementById("chat-messages");
    addMessageToChat(msg, chatMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('user data', ({ username, age, gender }) => {
    document.getElementById('username').textContent = username || 'Inconnu';
    document.getElementById('age').textContent = age || 'Inconnu';
    document.getElementById('gender').textContent = gender || 'Non spécifié';
  });

  socket.on('user list', updateUserList);

  socket.on('username exists', (username) => {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom "${username}" est déjà utilisé.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  // === 📺 GESTION SALONS ===
  document.querySelectorAll('.channel').forEach(channel => {
    channel.addEventListener('click', () => {
      document.querySelector('#message-input').value = '';
      selectedUser = null;

      document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
      channel.classList.add('selected');
      currentChannel = channel.textContent.replace('# ', '');

      socket.emit('joinRoom', currentChannel);
      document.querySelector('#chat-messages').innerHTML = '';
    });
  });

  socket.on('room created', (newRoom) => {
    const channelList = document.getElementById('channel-list');
    const li = document.createElement('li');
    li.classList.add('channel');
    li.textContent = `# ${newRoom}`;
    li.addEventListener('click', () => {
      document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
      li.classList.add('selected');
      currentChannel = newRoom;
      socket.emit('joinRoom', currentChannel);
      document.querySelector('#chat-messages').innerHTML = '';
    });
    channelList.appendChild(li);
  });

    // === ➕ CRÉATION DE SALON ===
  const createChannelBtn = document.getElementById("create-channel-button");
  createChannelBtn.addEventListener("click", () => {
    const input = document.getElementById("new-channel-name");
    const newRoomName = input.value.trim();

    if (!newRoomName) {
      showErrorMessage("❌ Le nom du salon est vide.");
      return;
    }

    if (newRoomName.length > 20 || /[^a-zA-Z0-9-_]/.test(newRoomName)) {
      showErrorMessage("❌ Nom de salon invalide (max 20 caractères, sans caractères spéciaux).");
      return;
    }

    socket.emit("createRoom", newRoomName);
    input.value = "";
  });

  socket.on('room exists', (roomName) => {
    showErrorMessage(`❌ Le salon "${roomName}" existe déjà.`);
  });

  socket.on('room created', (newRoom) => {
    const channelList = document.getElementById('channel-list');
    const li = document.createElement('li');
    li.classList.add('channel');
    li.textContent = `# ${newRoom}`;

    li.addEventListener('click', () => {
      document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
      li.classList.add('selected');
      currentChannel = newRoom;
      socket.emit('joinRoom', currentChannel);
      document.querySelector('#chat-messages').innerHTML = '';
    });

    channelList.appendChild(li);

    // Rejoindre automatiquement le nouveau salon créé
    document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));
    li.classList.add('selected');
    currentChannel = newRoom;
    socket.emit('joinRoom', currentChannel);
    document.querySelector('#chat-messages').innerHTML = '';
  });

  
  // === 🚀 INITIALISATION ===
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

  document.getElementById("username-submit").addEventListener("click", submitUserInfo);
  document.getElementById("message-input").addEventListener("keypress", e => {
    if (e.key === "Enter") sendMessage();
  });
});
