import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Structures pour stocker les utilisateurs, salons et messages
let users = {};             // { username: { id, gender, age, username } }
let messageHistory = {};    // { channel: [ { message, username, ... } ] }
let roomUsers = {};         // { channel: [ userData ] }
let userChannels = {};      // { socket.id: 'channelName' }

// Servir les fichiers statiques (front-end dans /public)
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique du salon "Général" par défaut
  socket.emit('chat history', messageHistory['Général'] || []);

  // Lorsqu'un utilisateur définit son nom
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);
    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    // Vérification d'unicité du pseudo
    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    // Enregistrement de l'utilisateur
    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    // Salon par défaut : "Général"
    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];

    // Ajout à la liste des utilisateurs du salon
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);

    // Mise à jour de la liste des utilisateurs du salon
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);

    socket.emit('username accepted', username);
  });

  // Lorsqu'un message est envoyé
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(u => u.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    if (!sender) {
      console.warn("⚠️ Message sans utilisateur défini");
    }

    console.log(`💬 ${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);

    if (!messageHistory[currentChannel]) messageHistory[currentChannel] = [];
    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift(); // Limite à 10 messages
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Lorsqu’un utilisateur rejoint un salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(u => u.id === socket.id);

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

    roomUsers[channel].push(user);

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Création d’un nouveau salon
  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(u => u.id === socket.id);

    if (disconnectedUser) {
      console.log(`❌ Déconnexion de ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]);
      }

      delete users[disconnectedUser.username];
      delete userChannels[socket.id];
    } else {
      console.log('❌ Déconnexion d’un utilisateur inconnu');
    }
  });
});

// PORT et lancement
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
