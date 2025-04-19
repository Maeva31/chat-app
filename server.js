const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Initialisation du serveur
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let channels = [
  { name: 'Général', users: [], messages: [] },
  { name: 'Musique', users: [], messages: [] },
  { name: 'Gaming', users: [], messages: [] },
  { name: 'Détente', users: [], messages: [] }
];

let users = [];

app.use(express.static('public'));

// Lorsque l'utilisateur se connecte
io.on('connection', (socket) => {
  console.log('Un utilisateur s\'est connecté');

  // Gérer l'inscription de l'utilisateur
  socket.on('userInfo', (userData) => {
    users.push({ ...userData, socketId: socket.id });
    io.emit('userList', users); // Mettre à jour la liste des utilisateurs
  });

  // Gérer la création de salons
  socket.on('createChannel', (channelName) => {
    const newChannel = { name: channelName, users: [], messages: [] };
    channels.push(newChannel);
    io.emit('channelList', channels); // Mettre à jour la liste des salons
  });

  // Gérer l'envoi de messages
  socket.on('sendMessage', (text) => {
    const currentChannel = channels.find(channel => channel.users.includes(socket.id));
    if (currentChannel) {
      const message = { username: users.find(user => user.socketId === socket.id).username, text };
      currentChannel.messages.push(message);
      io.emit('message', message);
    }
  });

  // Gérer l'entrée dans un salon
  socket.on('joinChannel', (channelName) => {
    const channel = channels.find(ch => ch.name === channelName);
    if (channel) {
      channel.users.push(socket.id);
      io.emit('userList', getUsersInChannel(channelName));
      io.emit('message', { username: 'System', text: `${users.find(user => user.socketId === socket.id).username} a rejoint le salon ${channelName}` });
    }
  });

  // Récupérer la liste des utilisateurs d'un salon
  function getUsersInChannel(channelName) {
    const channel = channels.find(ch => ch.name === channelName);
    if (channel) {
      return channel.users.map(userId => users.find(user => user.socketId === userId));
    }
    return [];
  }

  // Gérer la déconnexion d'un utilisateur
  socket.on('disconnect', () => {
    console.log('Un utilisateur s\'est déconnecté');
    users = users.filter(user => user.socketId !== socket.id);
    channels.forEach(channel => {
      channel.users = channel.users.filter(userId => userId !== socket.id);
    });
    io.emit('userList', users);
  });
});

// Démarrer le serveur sur le port 3000
server.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});
