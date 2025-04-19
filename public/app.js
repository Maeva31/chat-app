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

  // ✅ Version sécurisée et unique de updateUserList
  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = '';  // Réinitialiser la liste des utilisateurs avant de la remplir

    // Vérifier si les données des utilisateurs sont valides
    if (!Array.isArray(users)) {
      console.error("La liste des utilisateurs n'est pas un tableau.");
      return;
    }

    users.forEach(user => {
      // Vérification de la présence des données utilisateur avec valeurs par défaut
      const username = user?.username || 'Inconnu';
      const age = user?.age || '?';
      const gender = user?.gender || 'Non spécifié';

      // Créer un élément de liste pour chaque utilisateur
      const li = document.createElement('li');
      li.classList.add('user-item');  // Ajouter une classe pour un meilleur style CSS

      // Structure de l'élément utilisateur
      li.innerHTML = ` 
        <div class="gender-square" style="background-color: ${getGenderColor(gender)}">
          ${age}
        </div>
        <span class="username-span" style="color: ${getUsernameColor(gender)}">${username}</span>
      `;

      // Ajouter l'utilisateur à la liste
      userList.appendChild(li);
    });
  }

  // Historique des messages
  socket.on('chat history', function (messages) {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = '';
    messages.forEach(msg => addMessageToChat(msg, chatMessages));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Nouveau message
  socket.on('chat message', function (msg) {
    const chatMessages = document.getElementById("chat-messages");
    addMessageToChat(msg, chatMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  socket.on('user data', (userData) => {
    const username = userData.username || 'Inconnu';
    const age = userData.age || 'Inconnu';
    const gender = userData.gender || 'Non spécifié';

    document.getElementById('username').textContent = username;
    document.getElementById('age').textContent = age;
    document.getElementById('gender').textContent = gender;
  });

  socket.on('user list', function (users) {
  updateUserList(users);
});


  // Ajout de message dans le chat
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
        messageInput.value = mention + current; // Ajoute l'@pseudo avec un espace
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

  // Envoi de message
  function sendMessage() {
    const messageInput = document.getElementById("message-input");
    const message = messageInput.value.trim();
    const username = localStorage.getItem("username");

    if (!message) {
      showErrorMessage("Vous ne pouvez pas envoyer de message vide.");
      return;
    }

    if (message.length > 300) {
      showErrorMessage("Message trop long (300 caractères max).");
      return;
    }

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

  // Gestion des infos utilisateur
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

  // Pseudo déjà utilisé
  socket.on('username exists', function (username) {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom d'utilisateur "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  // Couleurs selon genre
  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  function getGenderColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // Mise à jour des utilisateurs
  socket.on('user list', updateUserList);

  // Sélection de salons
  const channelElements = document.querySelectorAll('.channel');
  channelElements.forEach(channel => {
    channel.addEventListener('click', () => {
      // Réinitialiser le champ de message
      const messageInput = document.getElementById("message-input");
      messageInput.value = '';  // Effacer le contenu du champ message

      // Réinitialiser le pseudo mentionné
      selectedUser = null;

      // Gérer le changement de salon
      channelElements.forEach(c => c.classList.remove('selected'));
      channel.classList.add('selected');
      currentChannel = channel.textContent.replace('# ', '');

      // Informer le serveur de rejoindre le salon
      socket.emit('joinRoom', currentChannel);

      // Réinitialiser l'affichage des messages
      document.querySelector('#chat-messages').innerHTML = '';
    });
  });

  // Salon créé dynamiquement
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

  // Chargement auto depuis localStorage
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

  // Soumission modal
  document.getElementById("username-submit").addEventListener("click", submitUserInfo);

  // Boîte à erreurs
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
