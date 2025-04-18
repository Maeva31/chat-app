import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Résolution de __dirname avec ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Statique
app.use(express.static(path.join(__dirname, 'public')));

// Données en mémoire
let channels = ['Général', 'Musique', 'Gaming', 'Détente'];
let users = {};            // username => { username, gender, age, id }
let messageHistory = {};   // channelName => [messages]
let roomUsers = {};        // channelName => [users]
let userChannels = {};     // socket.id => channelName

// Connexion Socket.io
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  // Rejoindre le salon par défaut
  const defaultChannel = 'Général';
  socket.join(defaultChannel);
  socket.emit('chat history', messageHistory[defaultChannel] || []);

  // Création d’un salon
  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      channels.push(newChannel);
      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Changement de salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || defaultChannel;
    const user = Object.values(users).find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    // Quitter l’ancien salon
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) roomUsers[channel] = [];

    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age
    });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      timestamp: new Date().toISOString(),
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Définition du nom d'utilisateur
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const invalid = !username || username.length > 16 || /\s/.test(username) || !age || isNaN(age) || age < 18 || age > 89;
    if (invalid || (users[username] && users[username].id !== socket.id)) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || defaultChannel;
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];

    // Évite les doublons
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
  });

  // Envoi de message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || defaultChannel;

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    console.log(`💬 ${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);
    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);

    if (disconnectedUser) {
      console.log(`❌ Déconnexion : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]);
      }

      delete users[disconnectedUser.username];
      delete userChannels[socket.id];
    } else {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
    }
  });
});

// Lancement du serveur
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
