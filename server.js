// server.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Utiliser __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialiser Express et HTTP
const app = express();
const server = createServer(app);
const io = new Server(server);

// Fichiers statiques (public/)
app.use(express.static(path.join(__dirname, 'public')));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// --- Données mémoire ---
const users = {};
const messageHistory = { Général: [] };
const userChannels = {};
const roomUsers = {};
const mutedUsers = {};
const bannedUsers = {};
const elevatedUsers = {
  'admin': 'admin',
  'modo': 'modo'
};
const defaultRole = 'user';

// --- Socket.io ---
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);
  socket.emit('chat history', messageHistory['Général'] || []);

  // Authentification
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    if (!username || users[username] || bannedUsers[username]) {
      return socket.emit('username exists', username);
    }

    if (!age || isNaN(age) || age < 18 || age > 89) {
      return socket.emit('username exists', username);
    }

    const role = elevatedUsers[username] || defaultRole;
    const userData = { username, gender, age, id: socket.id, role };
    users[username] = userData;

    const channel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = channel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    socket.emit('username accepted', username);
    io.to(channel).emit('user list', getUserListWithoutUser(username, channel));
  });

  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const channel = userChannels[socket.id] || 'Général';
    if (!sender || mutedUsers[socket.id]) return;

    const messageToSend = {
      username: sender.username,
      gender: sender.gender,
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel,
    };

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(messageToSend);
    if (messageHistory[channel].length > 10) {
      messageHistory[channel].shift();
    }

    io.to(channel).emit('chat message', messageToSend);
  });

  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(user => user.id === socket.id);
    if (!user) return socket.emit('error', 'Utilisateur non défini');

    socket.leave(oldChannel);
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', getUserListWithoutUser(user.username, oldChannel));
    }

    socket.join(channel);
    userChannels[socket.id] = channel;
    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel].push({ ...user, id: socket.id });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', getUserListWithoutUser(user.username, channel));
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });
  });

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  socket.on('moderation', (action) => {
    const sender = Object.values(users).find(u => u.id === socket.id);
    if (!sender || (sender.role !== 'admin' && sender.role !== 'modo')) {
      return socket.emit('error', 'Permission refusée');
    }

    const { command, targetUsername } = action;
    const target = users[targetUsername];
    if (!target) return socket.emit('error', 'Utilisateur non trouvé');

    switch (command) {
      case 'kick':
        io.to(target.id).emit('kicked');
        io.sockets.sockets.get(target.id)?.disconnect();
        break;
      case 'ban':
        bannedUsers[target.username] = true;
        io.to(target.id).emit('banned');
        io.sockets.sockets.get(target.id)?.disconnect();
        break;
      case 'mute':
        mutedUsers[target.id] = true;
        io.to(target.id).emit('muted');
        break;
      case 'unmute':
        delete mutedUsers[target.id];
        io.to(target.id).emit('unmuted');
        break;
    }

    console.log(`🛡️ ${sender.username} a utilisé ${command} sur ${target.username}`);
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(user => user.id === socket.id);
    if (user) {
      console.log(`❌ Déconnexion : ${user.username}`);
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
        io.to(channel).emit('user list', getUserListWithoutUser(user.username, channel));
      }
      delete users[user.username];
      delete userChannels[socket.id];
      delete mutedUsers[socket.id];
    } else {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (${socket.id})`);
    }
  });

  function getUserListWithoutUser(currentUsername, channel) {
    return (roomUsers[channel] || [])
      .filter(user => user.username !== '[USER]')
      .map(user => ({
        username: user.username,
        gender: user.gender,
        age: user.age
      }));
  }
});

// Lancer le serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
