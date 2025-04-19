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
    });

    newMessage.classList.add("chat-message");

    newMessage.innerHTML = `
      <span class="time">${timeString}</span>
      ${usernameSpan.outerHTML} : 
      <span class="message">${msg.message}</span>
    `;

    chatMessages.appendChild(newMessage);
  }

  // Clic pour rejoindre un salon
  document.getElementById("join-room").addEventListener("click", function () {
    const newChannel = prompt("Nom du salon à rejoindre :");
    if (newChannel) {
      socket.emit("joinRoom", newChannel);
    }
  });

  // Clic pour créer un salon
  document.getElementById("create-channel").addEventListener("click", function () {
    const newChannel = prompt("Nom du salon à créer :");
    if (newChannel) {
      socket.emit("createRoom", newChannel);
    }
  });

  // Gestion des utilisateurs
  socket.on("user list", updateUserList);

  // Fonction pour obtenir la couleur en fonction du genre
  function getGenderColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }
});
