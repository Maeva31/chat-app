import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};                // { username: { id, username, gender, age } }
const messageHistory = {};       // { roomName: [messages...] }
const roomUsers = {};            // { roomName: [userObjects...] }
const userChannels = {};         // { socket.id: roomName }

app.use(express.static('public'));

// 🔌 Connexion Socket
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  socket.emit('chat history', messageHistory['Général'] || []);

  // 📛 Authentification utilisateur
  socket.on('set username', ({ username, gender, age }) => {
    const invalidUsername = !username || username.length > 16 || /\s/.test(username);
    const invalidAge = !age || isNaN(age) || age < 18 || age > 89;

    if (invalidUsername || invalidAge) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { id: socket.id, username, gender, age };
    users[username] = userData;

    const channel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = channel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(channel).emit('user list', roomUsers[channel]);
    socket.emit('username accepted', username);
  });

  // 📨 Envoi de message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    if (!sender) return socket.emit('error', 'Utilisateur inconnu, message non envoyé.');

    const channel = userChannels[socket.id] || 'Général';
    const message = {
      username: sender.username,
      gender: sender.gender,
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel
    };

    console.log(`💬 ${message.username} dans #${channel}: ${message.message}`);

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(message);
    if (messageHistory[channel].length > 50) messageHistory[channel].shift(); // conservons + de messages

    io.to(channel).emit('chat message', message);
  });

  // 🚪 Déconnexion
  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
      return;
    }

    console.log(`❌ Déconnexion : ${user.username}`);
    io.emit('user disconnect', user.username);

    const channel = userChannels[socket.id];
    if (channel) {
      roomUsers[channel] = (roomUsers[channel] || []).filter(u => u.id !== socket.id);
      io.to(channel).emit('user list', roomUsers[channel]);
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon.`,
        channel
      });
    }

    delete users[user.username];
    delete userChannels[socket.id];
  });

  // 🔄 Changement de salon
  socket.on('joinRoom', (channel) => {
    const isValid = channel && channel.length <= 20 && /^[\w\-]+$/.test(channel);
    if (!isValid) return socket.emit('error', 'Nom de salon invalide.');

    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return socket.emit('error', 'Utilisateur non défini');

    const oldChannel = userChannels[socket.id] || 'Général';

    if (oldChannel !== channel) {
      socket.leave(oldChannel);
      roomUsers[oldChannel] = (roomUsers[oldChannel] || []).filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
    }

    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel].push({ ...user });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // ➕ Création de salon
  socket.on('createRoom', (newChannel) => {
    const isValid = newChannel && newChannel.length <= 20 && /^[\w\-]+$/.test(newChannel);
    if (!isValid) return socket.emit('error', 'Nom de salon invalide.');

    if (messageHistory[newChannel]) {
      socket.emit('room exists', newChannel);
      return;
    }

    messageHistory[newChannel] = [];
    roomUsers[newChannel] = [];

    console.log(`✅ Salon créé : ${newChannel}`);
    io.emit('room created', newChannel);
  });
});

// 🚀 Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
