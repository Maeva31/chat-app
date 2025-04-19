// Connexion au serveur Socket.io
const socket = io();

// Variables DOM
const modal = document.getElementById('myModal');
const usernameInput = document.getElementById('username-input');
const genderSelect = document.getElementById('gender-select');
const ageInput = document.getElementById('age-input');
const usernameSubmit = document.getElementById('username-submit');
const channelList = document.getElementById('channel-list');
const createChannelButton = document.getElementById('create-channel-button');
const newChannelName = document.getElementById('new-channel-name');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const usersList = document.getElementById('users');
const modalError = document.getElementById('modal-error');

// Variables utilisateur
let username = '';
let gender = '';
let age = '';

// Gérer l'inscription de l'utilisateur
usernameSubmit.addEventListener('click', () => {
  username = usernameInput.value;
  gender = genderSelect.value;
  age = ageInput.value;

  if (!username || !gender || !age) {
    modalError.textContent = 'Tous les champs sont obligatoires';
    modalError.style.display = 'block';
    return;
  }

  // Fermer la fenêtre modale et envoyer les données au serveur
  socket.emit('userInfo', { username, gender, age });
  modal.style.display = 'none';
});

// Gérer la création de salons
createChannelButton.addEventListener('click', () => {
  const channelName = newChannelName.value;
  if (channelName) {
    socket.emit('createChannel', channelName);
    newChannelName.value = ''; // Effacer l'input
  }
});

// Recevoir la liste des salons disponibles
socket.on('channelList', (channels) => {
  channelList.innerHTML = '';
  channels.forEach(channel => {
    const channelElement = document.createElement('li');
    channelElement.classList.add('channel');
    channelElement.textContent = `# ${channel.name}`;
    channelElement.addEventListener('click', () => {
      socket.emit('joinChannel', channel.name);
      updateChannelSelection(channel.name);
    });
    channelList.appendChild(channelElement);
  });
});

// Recevoir les messages du salon
socket.on('message', (message) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.textContent = `${message.username}: ${message.text}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll vers le bas
});

// Envoyer un message
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && messageInput.value) {
    socket.emit('sendMessage', messageInput.value);
    messageInput.value = ''; // Réinitialiser l'input
  }
});

// Mettre à jour la sélection du salon
function updateChannelSelection(channelName) {
  const channels = document.querySelectorAll('#channel-list .channel');
  channels.forEach(channel => {
    if (channel.textContent.includes(channelName)) {
      channel.classList.add('selected');
    } else {
      channel.classList.remove('selected');
    }
  });
}

// Recevoir la liste des utilisateurs dans le salon
socket.on('userList', (users) => {
  usersList.innerHTML = '';
  users.forEach(user => {
    const userElement = document.createElement('li');
    userElement.textContent = user.username;
    usersList.appendChild(userElement);
  });
});
