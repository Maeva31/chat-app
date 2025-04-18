import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = {};
let messageHistory = {};
let roomUsers = {};
let userChannels = {};

app.use(express.static('public'));

// 🔁 Fonction pour mettre à jour la liste des salons avec le nombre d'utilisateurs
function updateRoomList() {
  const rooms = Object.keys(roomUsers).map((roomName) => ({
    name: roomName,
    userCount: roomUsers[roomName]?.length || 0
  }));
  io.emit('room list', rooms);
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);
  socket.emit('chat history', messageHistory['Général'] || []);

  socket.on('set username', (data) => {
    const { username, gender, age, role } = data; // Récupération du rôle

    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);
    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, role: role || 'user', id: socket.id }; // Ajout du rôle
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans, Rôle : ${role})`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
    updateRoomList(); // ✅
  });

  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    console.log(`💬 ${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);

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

    updateRoomList(); // ✅
  });

  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

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
      age: user.age,
      role: user.role, // Ajout du rôle à la salle
    });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
    updateRoomList(); // ✅
  });

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
      updateRoomList(); // ✅
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Actions de modération
  socket.on('kick', (targetUsername) => {
    const requester = users[socket.id];
    if (requester && (requester.role === 'admin' || requester.role === 'modo')) {
      const target = Object.values(users).find(user => user.username === targetUsername);
      if (target) {
        io.to(target.id).emit('kick');
        target.leave(currentChannel);
        io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
        console.log(`${requester.username} a expulsé ${target.username}`);
      }
    } else {
      socket.emit('error', 'Vous n\'avez pas la permission de kick.');
    }
  });

  socket.on('ban', (targetUsername) => {
    const requester = users[socket.id];
    if (requester && requester.role === 'admin') {
      const target = Object.values(users).find(user => user.username === targetUsername);
      if (target) {
        io.to(target.id).emit('ban');
        target.leave(currentChannel);
        io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
        console.log(`${requester.username} a banni ${target.username}`);
      }
    } else {
      socket.emit('error', 'Vous n\'avez pas la permission de bannir.');
    }
  });

  socket.on('mute', (targetUsername) => {
    const requester = users[socket.id];
    if (requester && (requester.role === 'admin' || requester.role === 'modo')) {
      const target = Object.values(users).find(user => user.username === targetUsername);
      if (target) {
        target.isMuted = true; // Ajout de l'attribut isMuted
        io.to(target.id).emit('mute');
        console.log(`${requester.username} a mis en sourdine ${target.username}`);
      }
    } else {
      socket.emit('error', 'Vous n\'avez pas la permission de mute.');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
