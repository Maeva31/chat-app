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
let bannedUsers = new Set();
let mutedUsers = new Set();

app.use(express.static('public'));

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
    const { username, gender, age } = data;

    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);
    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    if (bannedUsers.has(username)) {
      socket.emit('banned', 'Vous avez été banni du serveur.');
      return;
    }

    const role = Object.keys(users).length === 0 ? 'admin' : 'user'; // Le premier connecté est admin
    const userData = { username, gender, age, id: socket.id, role };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans, rôle: ${role})`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
    updateRoomList();
  });

  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    if (sender && mutedUsers.has(sender.username)) {
      socket.emit('muted', 'Vous êtes muet et ne pouvez pas envoyer de messages.');
      return;
    }

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

    updateRoomList();
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
      role: user.role
    });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
    updateRoomList();
  });

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
      updateRoomList();
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // 🔧 Commandes de modération

  socket.on('moderation', ({ action, targetUsername }) => {
    const issuer = Object.values(users).find(u => u.id === socket.id);
    const target = users[targetUsername];

    if (!issuer || (issuer.role !== 'admin' && issuer.role !== 'modo')) {
      socket.emit('moderation failed', 'Permission refusée.');
      return;
    }

    if (!target) {
      socket.emit('moderation failed', 'Utilisateur introuvable.');
      return;
    }

    switch (action) {
      case 'kick':
        io.to(target.id).emit('kicked', 'Vous avez été expulsé du salon.');
        io.sockets.sockets.get(target.id)?.disconnect();
        break;
      case 'ban':
        bannedUsers.add(target.username);
        io.to(target.id).emit('banned', 'Vous avez été banni du serveur.');
        io.sockets.sockets.get(target.id)?.disconnect();
        break;
      case 'mute':
        mutedUsers.add(target.username);
        socket.emit('moderation success', `${target.username} a été mis en sourdine.`);
        break;
      case 'unmute':
        mutedUsers.delete(target.username);
        socket.emit('moderation success', `${target.username} peut de nouveau parler.`);
        break;
      default:
        socket.emit('moderation failed', 'Commande inconnue.');
        break;
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
