const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;
const channels = ['Général'];  // Salon de base
const roomUsers = { 'Général': [] };
const messageHistory = { 'Général': [] };

app.use(express.static('public'));

server.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log(`Nouvelle connexion : ${socket.id}`);

  // Ajout de l'utilisateur au salon général par défaut
  roomUsers['Général'].push(socket.id);
  socket.join('Général');
  io.to('Général').emit('user list', roomUsers['Général']);

  // Envoi de l'historique des messages du salon
  socket.emit('chat history', messageHistory['Général']);

  // Gestion de la création de salons
  socket.on('createRoom', (newChannel) => {
    if (!channels.includes(newChannel)) {
      channels.push(newChannel);
      roomUsers[newChannel] = [];
      messageHistory[newChannel] = [];
      io.emit('room created', newChannel);  // Informer tous les utilisateurs des salons
      io.emit('room list', channels);  // Mettre à jour la liste des salons pour tous les utilisateurs
    } else {
      socket.emit('room exists', newChannel);  // Salon déjà existant
    }
  });

  // Envoi de messages à un salon spécifique
  socket.on('chat message', (msg) => {
    const currentChannel = Object.keys(roomUsers).find(room => roomUsers[room].includes(socket.id)) || 'Général';

    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(msg);

    // Limiter l'historique à 10 messages
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', msg);
  });

  // Gérer la déconnexion d'un utilisateur
  socket.on('disconnect', () => {
    console.log(`❌ Déconnexion : ${socket.id}`);
    const currentChannel = Object.keys(roomUsers).find(room => roomUsers[room].includes(socket.id));

    if (currentChannel) {
      roomUsers[currentChannel] = roomUsers[currentChannel].filter(userId => userId !== socket.id);
      io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
      
      // Si le salon est vide, on le supprime
      if (roomUsers[currentChannel].length === 0) {
        channels = channels.filter(room => room !== currentChannel);
        delete roomUsers[currentChannel];
        delete messageHistory[currentChannel];
        io.emit('room list', channels);
      }
    }
  });
});
