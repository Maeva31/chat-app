document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  let selectedUser = null;
  let currentChannel = 'Général';
  const myUsername = localStorage.getItem('username');
  let myRole = 'user'; // rôle par défaut

  const genderColors = {
    Homme: '#00f',
    Femme: '#f0f',
    Autre: '#0ff',
    default: '#aaa'
  };

  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';
    if (!Array.isArray(users)) return;

    users.forEach(user => {
      const username = user?.username || 'Inconnu';
      if (username === '[USER]') return; // Ne pas afficher [USER]

      const age = user?.age || '?';
      const gender = user?.gender || 'Non spécifié';
      const role = user?.role || 'user';

      const li = document.createElement('li');
      li.classList.add('user-item');

      li.innerHTML = `
        <div class="gender-square" style="background-color: ${getGenderColor(gender)}">${age}</div>
        <span class="username-span" style="color: ${getUsernameColor(gender)}">${username}</span>
        <span class="role-tag ${role}">[${role}]</span>
      `;

      li.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        if (myRole === 'admin' || (myRole === 'modo' && role === 'user')) {
          showModerationMenu(e.pageX, e.pageY, username, role);
        }
      });

      userList.appendChild(li);
    });
  }

  function showModerationMenu(x, y, targetUsername, targetRole) {
    const menu = document.getElementById("moderation-menu");
    if (!menu) return;

    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.style.display = "block";

    menu.innerHTML = `
      <div class="mod-action" data-action="kick">🚪 Kick ${targetUsername}</div>
      <div class="mod-action" data-action="ban">⛔ Ban ${targetUsername}</div>
      <div class="mod-action" data-action="mute">🔇 Mute ${targetUsername}</div>
    `;

    menu.querySelectorAll('.mod-action').forEach(actionDiv => {
      actionDiv.addEventListener('click', () => {
        const action = actionDiv.dataset.action;
        socket.emit('moderation action', {
          action,
          target: targetUsername,
          by: myUsername,
          channel: currentChannel
        });
        menu.style.display = "none";
      });
    });
  }

  document.addEventListener("click", () => {
    const menu = document.getElementById("moderation-menu");
    if (menu) menu.style.display = "none";
  });

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

  socket.on('user data', (userData) => {
    document.getElementById('username').textContent = userData.username || 'Inconnu';
    document.getElementById('age').textContent = userData.age || 'Inconnu';
    document.getElementById('gender').textContent = userData.gender || 'Non spécifié';
    myRole = userData.role || 'user';
  });

  function addMessageToChat(msg, chatMessages) {
    const newMessage = document.createElement("div");
    const date = new Date(msg.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("clickable-username");
    const messageColor = (msg.role === 'admin') ? 'red' : (msg.role === 'modo') ? 'orange' : 'black';
    usernameSpan.style.color = messageColor;
    const username = msg.username || 'Inconnu';

    if (username === '[USER]') return; // Ne pas afficher les messages de [USER]

    usernameSpan.textContent = username;

    usernameSpan.addEventListener("click", function () {
      const messageInput = document.getElementById("message-input");
      const current = messageInput.value.trim();
      const mention = `@${msg.username}`;
      if (!current.includes(mention)) {
        messageInput.value = mention + " " + current;
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

    if (username === '[USER]') {
      showErrorMessage("Le pseudo [USER] n'est pas autorisé.");
      return;
    }

    if (!message) {
      showErrorMessage("Vous ne pouvez pas envoyer de message vide.");
      return;
    }

    if (message.length > 300) {
      showErrorMessage("Message trop long (300 caractères max).");
      return;
    }

    if (username) {
      socket.emit('send message', {
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

    if (username === '[USER]') {
      modalError.textContent = "❌ Le pseudo [USER] n'est pas autorisé.";
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
  channelElements.forEach(channel => {
    channel.addEventListener('click', () => {
      channelElements.forEach(c => c.classList.remove('selected'));
      channel.classList.add('selected');
      currentChannel = channel.textContent.replace('# ', '');
      socket.emit('joinRoom', currentChannel);
      document.querySelector('#chat-messages').innerHTML = '';
    });
  });

  socket.on('room created', function (newRoom) {
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
