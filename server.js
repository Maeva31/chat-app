const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const users = {};  // Stockage des utilisateurs connectés
const channels = {};  // Stockage des salons et de leurs messages

app.use(express.static('public'));  // Dossier pour servir les fichiers statiques (JS, CSS, HTML)

// Lorsqu'un utilisateur se connecte
io.on('connection', (socket) => {
  let username = null;
  let gender = null;
  let age = null;
  let currentChannel = 'Général';

  // Écoute l'événement de connexion d'un utilisateur
  socket.on('set username', (userData) => {
    username = userData.username;
    gender = userData.gender;
    age = userData.age;

    // Enregistrement de l'utilisateur
    users[username] = {
      socketId: socket.id,
      username,
      gender,
      age,
      role: 'user'  // Par défaut, le rôle est "user"
    };

    // Rejoindre un salon
    socket.join(currentChannel);
    io.emit('user list', Object.values(users));

    // Historique des messages pour le salon actuel
    socket.emit('chat history', channels[currentChannel] || []);
  });

  // Lorsqu'un utilisateur envoie un message
  socket.on('chat message', (msgData) => {
    const { username, message, timestamp, channel } = msgData;

    if (!channels[channel]) {
      channels[channel] = [];
    }

    const msg = {
      username,
      message,
      timestamp,
      gender: users[username]?.gender || 'Non spécifié'
    };

    // Sauvegarde du message dans le salon spécifique
    channels[channel].push(msg);

    // Envoi du message à tous les utilisateurs dans le salon
    io.to(channel).emit('chat message', msg);
  });

  // Lorsqu'un utilisateur se déconnecte
  socket.on('disconnect', () => {
    if (username) {
      delete users[username];
      io.emit('user list', Object.values(users));
    }
  });

  // Lorsqu'un utilisateur change de salon
  socket.on('joinRoom', (newChannel) => {
    socket.leave(currentChannel);  // Quitter l'ancien salon
    currentChannel = newChannel;
    socket.join(currentChannel);

    // Envoi de l'historique des messages pour le salon rejoint
    socket.emit('chat history', channels[currentChannel] || []);
  });

  // Fonction de modération : Kick, Ban, Mute
  socket.on('kick user', (data) => {
    const targetUser = users[data.username];
    if (targetUser && (users[username]?.role === 'admin' || users[username]?.role === 'modo')) {
      io.to(targetUser.socketId).emit('kick');
      io.emit('user list', Object.values(users));
    }
  });

  socket.on('ban user', (data) => {
    const targetUser = users[data.username];
    if (targetUser && (users[username]?.role === 'admin' || users[username]?.role === 'modo')) {
      io.to(targetUser.socketId).emit('ban');
      io.emit('user list', Object.values(users));
    }
  });

  socket.on('mute user', (data) => {
    const targetUser = users[data.username];
    if (targetUser && (users[username]?.role === 'admin' || users[username]?.role === 'modo')) {
      io.to(targetUser.socketId).emit('mute');
      io.emit('user list', Object.values(users));
    }
  });

  // Création de salon
  socket.on('createRoom', (newRoom) => {
    if (!channels[newRoom]) {
      channels[newRoom] = [];
      io.emit('room created', newRoom);
    }
  });
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
