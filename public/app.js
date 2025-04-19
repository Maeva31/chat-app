const socket = io();

// Variables pour l'interface
const usernameInput = document.getElementById('username-input');
const genderSelect = document.getElementById('gender-select');
const ageInput = document.getElementById('age-input');
const usernameSubmit = document.getElementById('username-submit');
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const usersList = document.getElementById('users');
const channelList = document.getElementById('channel-list');
const createChannelButton = document.getElementById('create-channel-button');
const newChannelName = document.getElementById('new-channel-name');

// Variables pour la gestion du salon
let currentUser = null;
let currentChannel = '💬 ┊ Général';

// Modal d'inscription
usernameSubmit.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const gender = genderSelect.value;
  const age = ageInput.value.trim();

  if (username && gender && age >= 18 && age <= 89) {
    currentUser = { username, gender, age };
    socket.emit('user-joined', currentUser);
    document.getElementById('myModal').style.display = 'none';
  } else {
    document.getElementById('modal-error').style.display = 'block';
  }
});

// Envoi de message
messageInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    socket.emit('send-message', { message: messageInput.value, channel: currentChannel });
    messageInput.value = '';
  }
});

// Changement de salon
channelList.addEventListener('click', (e) => {
  if (e.target.classList.contains('channel')) {
    currentChannel = e.target.innerText;
    socket.emit('switch-channel', currentChannel);
  }
});

// Création de salon
createChannelButton.addEventListener('click', () => {
  const channelName = newChannelName.value.trim();
  if (channelName) {
    socket.emit('create-channel', channelName);
  }
});

// Réception de messages
socket.on('message', (data) => {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  messageElement.innerHTML = `<strong>${data.username}</strong>: ${data.message}`;
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Affichage des utilisateurs
socket.on('user-list', (users) => {
  usersList.innerHTML = '';
  users.forEach(user => {
    const userElement = document.createElement('li');
    userElement.innerHTML = `<span class="username-span">${user.username}</span>`;
    usersList.appendChild(userElement);
  });
});

// Affichage des salons
socket.on('channel-list', (channels) => {
  channelList.innerHTML = '';
  channels.forEach(channel => {
    const channelElement = document.createElement('li');
    channelElement.classList.add('channel');
    channelElement.innerText = `# ${channel}`;
    channelList.appendChild(channelElement);
  });
});
