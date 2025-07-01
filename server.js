import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import {
  loadModerators,
  getUserRole,
  requiresPassword,
  validatePassword,
  addUser,
  removeUser,
  users,
  bannedUsers,
  mutedUsers
} from './userManagement.js';

import {
  joinRoom,
  createRoom,
  cleanupEmptyRooms,
  emitUserList,
  updateRoomUserCounts,
  getMessageHistory
} from './roomManagement.js';

import { handleCommand } from './moderation.js';
import { handleMessage } from './messageHandling.js';

// --- IMPORT AJOUTÉ ICI ---
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

loadModerators();

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/chat.html');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const userChannels = {}; // socket.id => channel

io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

  const defaultChannel = 'Général';
  userChannels[socket.id] = defaultChannel;
  socket.join(defaultChannel);

  socket.emit('chat history', getMessageHistory(defaultChannel));
  emitUserList(io, defaultChannel);
  io.emit('room list', joinRoom.getRooms ? joinRoom.getRooms() : []);
  updateRoomUserCounts(io);

  socket.on('set username', (data) => {
    const { username, gender, age, invisible, password } = data;

    if (!username || username.length > 16 || /\s/.test(username)) {
      return socket.emit('username error', 'Pseudo invalide (vide, espaces interdits, max 16 caractères)');
    }
    if (isNaN(age) || age < 18 || age > 89) {
      return socket.emit('username error', 'Âge invalide (entre 18 et 89)');
    }
    if (!gender) {
      return socket.emit('username error', 'Genre non spécifié');
    }

    if (bannedUsers.has(username)) {
      socket.emit('username error', 'Vous êtes banni du serveur.');
      socket.emit('redirect', 'https://banned.maevakonnect.fr');
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      return socket.emit('username exists', username);
    }

    if (requiresPassword(username)) {
      if (!password) {
        return socket.emit('password required', username);
      }
      if (!validatePassword(username, password)) {
        return socket.emit('password error', 'Mot de passe incorrect pour ce compte privilégié.');
      }
      console.log(`🔐 Authentification réussie pour ${username}`);
    }

    const role = getUserRole(username);
    const invisibleFromClient = invisible === true;
    const prevInvisible = users[username]?.invisible ?? invisibleFromClient;

    addUser(socket, { username, gender, age, role, invisible: prevInvisible });

    let channel = userChannels[socket.id] || defaultChannel;
    socket.join(channel);

    if (!emitUserList.roomUsers) emitUserList.roomUsers = {};
    if (!emitUserList.roomUsers[channel]) emitUserList.roomUsers[channel] = [];
    emitUserList.roomUsers[channel] = emitUserList.roomUsers[channel].filter(u => u.id !== socket.id);
    emitUserList.roomUsers[channel].push(users[username]);

    console.log(`👤 Connecté : ${username} (${gender}, ${age} ans) dans #${channel} rôle=${role} invisible=${prevInvisible}`);

    emitUserList(io, channel);
    socket.emit('username accepted', { username, gender, age });
    socket.emit('chat history', getMessageHistory(channel));
    updateRoomUserCounts(io);

    if (!users[username].invisible) {
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${username} a rejoint le salon ${channel}`,
        timestamp: new Date().toISOString(),
        channel
      });
    }
  });

  socket.on('chat message', (msg) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    if (msg.message.startsWith('/')) {
      handleCommand(io, socket, msg, userChannels);
    } else {
      handleMessage(io, socket, msg, userChannels, bannedUsers, mutedUsers);
    }
  });

  socket.on('joinRoom', (newChannel) => {
    joinRoom(io, socket, newChannel, userChannels, users);
  });

  socket.on('createRoom', (newChannel) => {
    createRoom(io, socket, newChannel, userChannels, users);
  });

  socket.on('request history', (roomName) => {
    if (roomName && getMessageHistory(roomName)) {
      socket.emit('chat history', getMessageHistory(roomName));
    }
  });

  socket.on('logout', () => {
    logout(socket);
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (user) {
      console.log(`❌ Déconnexion : ${user.username}`);

      const channel = userChannels[socket.id];
      if (channel && !user.invisible) {
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a quitté le serveur`,
          timestamp: new Date().toISOString(),
          channel
        });
      }

      for (const chan in emitUserList.roomUsers) {
        emitUserList.roomUsers[chan] = emitUserList.roomUsers[chan].filter(u => u.id !== socket.id);
        emitUserList(io, chan);
      }

      removeUser(socket);
      delete userChannels[socket.id];
      cleanupEmptyRooms(io);
    } else {
      console.log(`❌ Déconnexion inconnue : ${socket.id}`);
    }
  });

  function logout(socket) {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) {
      console.log(`Logout : utilisateur non trouvé pour socket ${socket.id}`);
      return;
    }

    const channel = userChannels[socket.id];
    if (channel && !user.invisible) {
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le serveur (logout)`,
        timestamp: new Date().toISOString(),
        channel
      });
    }

    if (emitUserList.roomUsers[channel]) {
      emitUserList.roomUsers[channel] = emitUserList.roomUsers[channel].filter(u => u.id !== socket.id);
      emitUserList(io, channel);
    }

    removeUser(socket);
    delete userChannels[socket.id];

    socket.disconnect(true);
    cleanupEmptyRooms(io);

    console.log(`🔒 Logout : ${user.username} déconnecté.`);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
