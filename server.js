const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = new Map(); // socket.id → { username, gender, age, room }
const usernames = new Set(); // pour vérifier l'unicité
const messageHistory = {}; // channel → [messages]
const userChannels = {}; // socket.id → room

const defaultRoom = 'Général';

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`✅ ${socket.id} connecté.`);

  // 🔐 Authentification de l'utilisateur
  socket.on('set username', ({ username, gender, age }) => {
    if (usernames.has(username)) {
      socket.emit('username exists', username);
      return;
    }

    usernames.add(username);
    users.set(socket.id, { username, gender, age, room: defaultRoom });
    userChannels[socket.id] = defaultRoom;
    socket.join(defaultRoom);

    console.log(`👤 ${username} rejoint ${defaultRoom}`);
    io.to(defaultRoom).emit('chat message', {
      username: 'SYSTEM',
      message: `${username} a rejoint le salon.`,
      timestamp: new Date().toISOString(),
      gender: 'Autre'
    });

    // Envoie l’historique au nouvel utilisateur
    if (messageHistory[defaultRoom]) {
      socket.emit('chat history', messageHistory[defaultRoom]);
    } else {
      messageHistory[defaultRoom] = [];
    }

    updateUserList();

    socket.emit('user data', { username, gender, age });
  });

  // 📥 Réception d’un message
  socket.on('chat message', (msg) => {
    const user = users.get(socket.id);
    if (!user) return;

    const { room } = user;
    const messageObj = {
      username: user.username,
      message: msg.message,
      timestamp: msg.timestamp,
      gender: user.gender
    };

    if (!messageHistory[room]) messageHistory[room] = [];
    messageHistory[room].push(messageObj);

    io.to(room).emit('chat message', messageObj);
  });

  // 📂 Rejoindre un autre salon
  socket.on('joinRoom', (newRoom) => {
    const user = users.get(socket.id);
    if (!user) return;

    const oldRoom = user.room;
    socket.leave(oldRoom);
    socket.join(newRoom);

    user.room = newRoom;
    userChannels[socket.id] = newRoom;

    if (!messageHistory[newRoom]) messageHistory[newRoom] = [];

    socket.emit('chat history', messageHistory[newRoom]);

    console.log(`🔁 ${user.username} a changé de salon : ${oldRoom} ➡️ ${newRoom}`);

    updateUserList();
  });

  // 🆕 Création d’un salon
  socket.on('create room', (roomName) => {
    if (!roomName || typeof roomName !== 'string') return;
    messageHistory[roomName] = messageHistory[roomName] || [];

    socket.emit('room created', roomName);
  });

  // ❌ Déconnexion
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      usernames.delete(user.username);
      users.delete(socket.id);
      delete userChannels[socket.id];
      updateUserList();
      console.log(`❌ ${user.username} (${socket.id}) déconnecté`);
    }
  });

  // 🔁 Envoie la liste à tous les clients
  function updateUserList() {
    const room = userChannels[socket.id] || defaultRoom;
    const userList = [];

    for (const [id, user] of users.entries()) {
      if (user.room === room) {
        userList.push({
          username: user.username,
          gender: user.gender,
          age: user.age
        });
      }
    }

    io.to(room).emit('user list', userList);
  }
});

// 🚀 Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
