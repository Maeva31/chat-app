import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = [];
let messageHistory = {}; // Historique des messages par salon
let userChannels = {};   // Association socket.id → salon
let roomUsers = {};      // Utilisateurs par salon

// Fichiers statiques
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique par défaut (salon Général)
  socket.emit('chat history', messageHistory['Général'] || []);

  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const usernameIsInvalid =
      !username || username.length > 16 || /\s/.test(username);

    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    const alreadyExists = users.some(
      (user) => user.username === username && user.id !== socket.id
    );

    if (alreadyExists) {
      socket.emit('username exists', username);
      return;
    }

    // 🔁 Mise à jour ou ajout dans `users`
    const existingUserIndex = users.findIndex(user => user.id === socket.id);
    const userData = { username, gender, age, id: socket.id };

    if (existingUserIndex !== -1) {
      users[existingUserIndex] = userData;
    } else {
      users.push(userData);
    }

    // 🔁 Rejoindre ou mettre à jour le salon
    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) {
      roomUsers[currentChannel] = [];
    }

    // Supprimer l'utilisateur précédent dans le salon
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré ou mis à jour : ${username} (${gender}, ${age} ans)`);

    // 🔁 Mettre à jour la liste des utilisateurs dans le salon
    io.to(currentChannel).emit('user list', roomUsers[currentChannel].map(u => u.username));

    // Optionnel : notifier du changement
    socket.emit('username accepted', username);
  });

  socket.on('chat message', (msg) => {
    const sender = users.find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Anonyme",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    console.log(`💬 ${messageToSend.username} dans #${messageToSend.channel}: ${messageToSend.message}`);

    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      // Retirer l'utilisateur de tous les salons
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel].map(user => user.username));
      }
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }

    users = users.filter(user => user.id !== socket.id);
    io.emit('user list', users);
    delete userChannels[socket.id];
  });

  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = users.find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    // Quitter ancien salon
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel].map(u => u.username));
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) {
      roomUsers[channel] = [];
    }

    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age
    });

    console.log(`👥 ${socket.id} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel].map(u => u.username));
  });

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Nouveau salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
