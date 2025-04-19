document.addEventListener("DOMContentLoaded", function() {
  const socket = io();

  let currentUser = JSON.parse(localStorage.getItem("user")) || { pseudo: "", genre: "", age: "" };
  let currentChannel = 'Général';

  // Fonction pour ajouter un message dans le chat
  function addMessageToChat(msg, chatMessages) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");
    messageElement.textContent = msg;
    chatMessages.appendChild(messageElement);
  }

  // Connexion de l'utilisateur
  function submitUserInfo() {
    currentUser.pseudo = document.getElementById("username").value;
    currentUser.genre = document.querySelector('input[name="genre"]:checked').value;
    currentUser.age = document.getElementById("age").value;

    if (currentUser.pseudo && currentUser.genre && currentUser.age) {
      localStorage.setItem("user", JSON.stringify(currentUser));
      socket.emit('user info', currentUser);
      document.getElementById("myModal").style.display = "none";
    } else {
      alert("Veuillez remplir tous les champs.");
    }
  }

  // Fonction d'envoi de message
  function sendMessage() {
    const messageInput = document.getElementById("message-input");
    const message = messageInput.value.trim();
    
    if (message) {
      socket.emit('chat message', message);
      messageInput.value = '';
    }
  }

  // Mettre à jour la liste des salons
  socket.on('room list', function (rooms) {
    const roomList = document.getElementById("room-list");
    roomList.innerHTML = '';
    rooms.forEach(room => {
      const roomDiv = document.createElement("div");
      roomDiv.classList.add("channel");
      roomDiv.textContent = `# ${room}`;
      roomList.appendChild(roomDiv);
    });
    addChannelClickListeners();
  });

  // Ajouter un listener pour chaque salon
  function addChannelClickListeners() {
    const channels = document.querySelectorAll('.channel');
    channels.forEach(channel => {
      channel.addEventListener('click', function() {
        currentChannel = channel.textContent.slice(2);  // Retirer le # du nom du salon
        document.getElementById("current-room").textContent = `# ${currentChannel}`;
        socket.emit('chat history', currentChannel);
      });
    });
  }

  // Création d'un nouveau salon
  document.getElementById("create-room-button").addEventListener('click', function() {
    const newChannelName = prompt("Entrez le nom du nouveau salon:");
    if (newChannelName) {
      socket.emit('createRoom', newChannelName);
    }
  });

  // Mise à jour des messages
  socket.on('chat message', function (msg) {
    const chatMessages = document.getElementById("chat-messages");
    addMessageToChat(msg, chatMessages);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Affichage de l'historique du salon
  socket.on('chat history', function (messages) {
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.innerHTML = '';
    messages.forEach(msg => addMessageToChat(msg, chatMessages));
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  // Gestion des erreurs de pseudo
  socket.on('username exists', function (username) {
    const modalError = document.getElementById("modal-error");
    modalError.textContent = `Le nom d'utilisateur "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = "block";
    localStorage.removeItem("username");
    document.getElementById("myModal").style.display = "block";
  });

  // Modal de validation de l'utilisateur
  document.getElementById("submit-user-info").addEventListener('click', submitUserInfo);

  // Fermeture du modal lorsqu'on clique en dehors
  window.onclick = function(event) {
    if (event.target == document.getElementById("myModal")) {
      document.getElementById("myModal").style.display = "none";
    }
  };

  // Initialisation de la connexion Socket.io
  socket.on('connect', function() {
    if (!currentUser.pseudo) {
      document.getElementById("myModal").style.display = "block";
    }
  });
});
