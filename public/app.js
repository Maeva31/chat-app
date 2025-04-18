document.addEventListener('DOMContentLoaded', function () {
  const socket = io();
  let selectedUser = null;

  const genderColors = {
    Homme: '#00f',
    Femme: '#f0f',
    Autre: '#0ff',
    default: '#aaa'
  };

  // Affiche l'historique des messages
  socket.on('chat history', function (messages) {
    const chatMessages = document.getElementById("chat-messages");
    messages.forEach(msg => addMessageToChat(msg, chatMessages));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Réception d'un nouveau message
  socket.on('chat message', function (msg) {
    const chatMessages = document.getElementById("chat-messages");
    addMessageToChat(msg, chatMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Ajouter un message
  function addMessageToChat(msg, chatMessages) {
    const newMessage = document.createElement("div");
    const date = new Date(msg.timestamp);
    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const usernameSpan = document.createElement("span");
    usernameSpan.classList.add("clickable-username");
    usernameSpan.style.color = getUsernameColor(msg.gender);
    usernameSpan.textContent = msg.username;

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

    // Ajout du message au chat sans animation
    newMessage.innerHTML = `[${timeString}] `;
    newMessage.appendChild(usernameSpan);
    newMessage.insertAdjacentHTML("beforeend", `: ${msg.message}`);
    newMessage.classList.add("message");
    newMessage.dataset.username = msg.username;

    chatMessages.appendChild(newMessage);
  }

  // Déconnexion utilisateur
  window.addEventListener("beforeunload", function () {
    const username = localStorage.getItem("username");
    if (username) {
      socket.emit("user disconnect", username);
    }
  });

  // Fonction principale pour soumettre les infos utilisateur
  function submitUserInfo() {
    const usernameInput = document.getElementById("username-input");
    const genderSelect = document.getElementById("gender-select");
    const ageInput = document.getElementById("age-input");
    const modalError = document.getElementById("modal-error");

    const username = usernameInput.value.trim();
    const gender = genderSelect.value;
    const age = parseInt(ageInput.value.trim(), 10);

    // Validation
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

    modalError.style.display = "none"; // Cache l'erreur lorsque tout est valide

    localStorage.setItem("username", username);
    localStorage.setItem("gender", gender);
    localStorage.setItem("age", age);
    socket.emit('set username', { username, gender, age });
    document.getElementById("myModal").style.display = "none";
  }

  // Message d'erreur temporaire en bas de page
  function showErrorMessage(message) {
    const errorMessage = document.createElement("div");
    errorMessage.classList.add("error-message");
    errorMessage.textContent = message;
    document.body.appendChild(errorMessage);
    setTimeout(() => errorMessage.remove(), 3000);
  }

  // Charger les infos sauvegardées
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

  // Bouton "Valider" dans le modal
  document.getElementById("username-submit").addEventListener("click", submitUserInfo);

  // Entrée dans le modal
  document.getElementById("myModal").addEventListener("keypress", function (event) {
    if (event.key === "Enter") submitUserInfo();
  });

  // Envoyer un message
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
        channel: currentChannel // Ajouter le salon ici
      });
      messageInput.value = "";
    }
  }

  // Entrée pour envoyer un message
  document.getElementById("message-input").addEventListener("keypress", function (event) {
    if (event.key === "Enter") sendMessage();
  });

  // Mise à jour de la liste des utilisateurs connectés
  function updateUserList(users) {
    const userList = document.getElementById('users');
    userList.innerHTML = ''; // Vider la liste avant de la remplir

    users.forEach(user => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="gender-square" style="background-color: ${getGenderColor(user.gender)}">
          ${user.age}
        </div>
        <span class="username-span" style="color: ${getUsernameColor(user.gender)}">${user.username}</span>
      `;
      userList.appendChild(li);
    });
  }

  // Couleur pseudo
  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // Couleur carré genre
  function getGenderColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // Username déjà existant
  socket.on('username exists', function (username) {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom d'utilisateur "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  // Déconnexion utilisateur
  socket.on('user disconnect', function (disconnectedUser) {
    const usersList = document.getElementById("users");
    const userItems = usersList.getElementsByTagName("li");
    for (let i = 0; i < userItems.length; i++) {
      if (userItems[i].textContent.includes(disconnectedUser)) {
        usersList.removeChild(userItems[i]);
        break;
      }
    }
  });

  // Réception liste utilisateurs
  socket.on('user list', updateUserList);

  // Gestion du salon
  let currentChannel = 'Général'; // Salon par défaut

  const channelElements = document.querySelectorAll('.channel');

  channelElements.forEach(channel => {
    channel.addEventListener('click', () => {
      // Supprime la classe "selected" de tous les salons
      channelElements.forEach(c => c.classList.remove('selected'));

      // Ajoute "selected" au salon cliqué
      channel.classList.add('selected');

      // Met à jour le salon actuel
      currentChannel = channel.textContent.replace('# ', '');
      console.log('Salon actuel :', currentChannel);

      // 👉 Tu peux ici envoyer l'info au serveur pour changer de room socket.io
      socket.emit('joinRoom', currentChannel);
      
      // Efface les messages ou filtre selon le salon
      document.querySelector('#chat-messages').innerHTML = '';
    });
  });
});
