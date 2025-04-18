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

  // Fonction pour mettre à jour la liste des utilisateurs
  function updateUserList(users) {
    const userList = document.getElementById('users');
    if (!userList) return; // Vérifier si l'élément existe
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
        <div class="gender-square" style="background-color: ${getGenderColor(gender)}">
          ${age}
        </div>
        <span class="username-span" style="color: ${getUsernameColor(gender)}">${username}</span>
      `;
      userList.appendChild(li);
    });
  }

  socket.on('chat history', function (messages) {
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      chatMessages.innerHTML = '';
      messages.forEach(msg => addMessageToChat(msg, chatMessages));
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });

  socket.on('chat message', function (msg) {
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      addMessageToChat(msg, chatMessages);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });

  socket.on('user data', (userData) => {
    if (userData) {
      document.getElementById('username').textContent = userData.username || 'Inconnu';
      document.getElementById('age').textContent = userData.age || 'Inconnu';
      document.getElementById('gender').textContent = userData.gender || 'Non spécifié';
    }
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

  const messageInput = document.getElementById("message-input");
  if (messageInput) {
    messageInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") sendMessage();
    });
  }

  function submitUserInfo() {
    const username = document.getElementById("username-input").value.trim();
    const gender = document.getElementById("gender-select").value;
    const age = parseInt(document.getElementById("age-input").value.trim(), 10);
    const modalError = document.getElementById("modal-error");

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

  socket.on('username exists', function (username) {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom d'utilisateur "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  function getGenderColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  socket.on('user list', updateUserList);

  const channelElements = document.querySelectorAll('.channel');
  if (channelElements) {
    channelElements.forEach(channel => {
      channel.addEventListener('click', () => {
        document.getElementById("message-input").value = '';
        selectedUser = null;
        channelElements.forEach(c => c.classList.remove('selected'));
        channel.classList.add('selected');
        currentChannel = channel.textContent.replace('# ', '');
        socket.emit('joinRoom', currentChannel);
        document.querySelector('#chat-messages').innerHTML = '';
      });
    });
  }

  // Gestion de la création du salon
  socket.on('room created', function (newRoom) {
    const channelList = document.getElementById('channel-list');
    if (channelList) {
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
    }
  });

  // Création d'un salon (exemple)
  const createRoomBtn = document.getElementById('create-room-btn');
  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
      const newRoom = prompt('Nom du nouveau salon :');
      if (newRoom && newRoom.trim() !== '') {
        socket.emit('createRoom', newRoom.trim());
      }
    });
  }

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

  const usernameSubmitBtn = document.getElementById("username-submit");
  if (usernameSubmitBtn) {
    usernameSubmitBtn.addEventListener("click", submitUserInfo);
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
});
