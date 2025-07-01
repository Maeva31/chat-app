import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';

import { getUserRole, requiresPassword } from './utils/roles.js';
import { loadSavedRooms, cleanupEmptyDynamicRooms, updateRoomUserCounts } from './utils/rooms.js';
import { emitUserList } from './utils/users.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

let users = {};           // { username: { id, username, gender, age, role, banned, muted, invisible } }
let messageHistory = {};
let roomUsers = {};
let userChannels = {};
let bannedUsers = new Set();   // pseudos bannis (simple set, pour persister on peut ajouter fichier json)
let mutedUsers = new Set();    // pseudos mutés

// Chargement des modérateurs
let modData = { admins: [], modos: [] };
try {
  const data = fs.readFileSync('moderators.json', 'utf-8');
  modData = JSON.parse(data);
} catch (e) {
  console.warn("⚠️ Impossible de charger moderators.json, pas de modérateurs définis.");
}

// Chargement des mots de passe pour les rôles privilégiés
let passwords = {};
try {
  const data = fs.readFileSync('passwords.json', 'utf-8');
  passwords = JSON.parse(data);
  console.log("✅ Mots de passe des modérateurs chargés");
} catch (e) {
  console.warn("⚠️ Impossible de charger passwords.json, pas d'authentification renforcée.");
}

const savedRooms = loadSavedRooms();
savedRooms.forEach(room => {
  if (!messageHistory[room]) messageHistory[room] = [];
  if (!roomUsers[room]) roomUsers[room] = [];
});

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.redirect('/chat.html');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

  function logout(socket) {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) {
      console.log(`Logout : utilisateur non trouvé pour socket ${socket.id}`);
      return;
    }

    const room = userChannels[socket.id];
    if (room) {
      if (!user.invisible) {
        io.to(room).emit('chat message', {
          username: 'Système',
          message: `${user.username} a quitté le serveur (logout)`,
          timestamp: new Date().toISOString(),
          channel: room
        });
      }

      if (roomUsers[room]) {
        roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
        emitUserList(room, roomUsers, io);
      }
    }

    delete users[user.username];
    delete userChannels[socket.id];

    socket.disconnect(true);

    // Nettoyer les salons dynamiques vides si besoin
    cleanupEmptyDynamicRooms(savedRooms, messageHistory, roomUsers, io);

    console.log(`🔒 Logout : ${user.username} déconnecté.`);
  }

  socket.on('logout', () => {
    logout(socket);
  });

  socket.on('ping', () => {
    socket.emit('pong');
  });

  const defaultChannel = 'Général';
  userChannels[socket.id] = defaultChannel;
  socket.join(defaultChannel);

  socket.emit('chat history', messageHistory[defaultChannel]);
  emitUserList(defaultChannel, roomUsers, io);
  socket.emit('room list', savedRooms);
  updateRoomUserCounts(roomUsers, io);

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

    // Mot de passe pour les rôles privilégiés
    if (requiresPassword(username, modData, passwords)) {
      if (!password) {
        return socket.emit('password required', username);
      }
      if (passwords[username] !== password) {
        return socket.emit('password error', 'Mot de passe incorrect pour ce compte privilégié.');
      }
      console.log(`🔐 Authentification réussie pour ${username}`);
    }

    const invisibleFromClient = invisible === true;
    const prevInvisible = users[username]?.invisible ?? invisibleFromClient;

    const role = getUserRole(username, modData);
    const userData = { username, gender, age, id: socket.id, role, banned: false, muted: false, invisible: prevInvisible };
    users[username] = userData;

    let channel = userChannels[socket.id] || defaultChannel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    console.log(`👤 Connecté : ${username} (${gender}, ${age} ans) dans #${channel} rôle=${role} invisible=${userData.invisible}`);

    emitUserList(channel, roomUsers, io);
    socket.emit('username accepted', { username, gender, age });
    socket.emit('chat history', messageHistory[channel]);
    updateRoomUserCounts(roomUsers, io);

    if (!userData.invisible) {
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${username} a rejoint le salon ${channel}`,
        timestamp: new Date().toISOString(),
        channel
      });
    }
  });

  // ... Le reste du code reste inchangé, mais remplace chaque appel
  // d'emitUserList(channel) par emitUserList(channel, roomUsers, io)
  // et chaque appel updateRoomUserCounts() par updateRoomUserCounts(roomUsers, io)
  // et chaque cleanupEmptyDynamicRooms() par cleanupEmptyDynamicRooms(savedRooms, messageHistory, roomUsers, io)

  // Par exemple dans 'chat message', 'joinRoom', 'createRoom', 'disconnect', etc.

  socket.on('chat message', (msg) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const channel = userChannels[socket.id] || defaultChannel;

    if (bannedUsers.has(user.username)) {
      socket.emit('error message', 'Vous êtes banni du serveur.');
      socket.emit('redirect', 'https://banned.maevakonnect.fr');
      return;
    }

    if (mutedUsers.has(user.username)) {
      socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages.');
      return;
    }

    if (msg.message.startsWith('/')) {
      if (user.role !== 'admin' && user.role !== 'modo') {
        socket.emit('no permission');
        return;
      }

      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);

      const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');
      const isUserModo = user.role === 'modo';

      switch (cmd) {
        // ... commandes comme avant, inchangées ...
      }
    }

    const message = {
      username: user.username,
      gender: user.gender,
      role: user.role,
      message: msg.message || '',
      timestamp: msg.timestamp || new Date().toISOString(),
      channel
    };

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(message);
    if (messageHistory[channel].length > MAX_HISTORY) {
      messageHistory[channel].shift();
    }

    io.to(channel).emit('chat message', message);
  });

  // … Autres handlers (joinRoom, createRoom, disconnect) avec les mêmes modifications d’appel aux fonctions utilitaires

  socket.on('joinRoom', (newChannel) => {
    // … code similaire, avec emitUserList(newChannel, roomUsers, io), etc.
  });

  socket.on('createRoom', (newChannel) => {
    // … idem, appelle cleanupEmptyDynamicRooms(savedRooms, messageHistory, roomUsers, io), etc.
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (user) {
      console.log(`❌ Déconnexion : ${user.username}`);

      const room = userChannels[socket.id];
      if (room) {
        if (!user.invisible) {
          io.to(room).emit('chat message', {
            username: 'Système',
            message: `${user.username} a quitté le serveur`,
            timestamp: new Date().toISOString(),
            channel: room
          });
        }
      }

      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
        emitUserList(channel, roomUsers, io);
      }

      delete users[user.username];
      delete userChannels[socket.id];

      cleanupEmptyDynamicRooms(savedRooms, messageHistory, roomUsers, io);
    } else {
      console.log(`❌ Déconnexion inconnue : ${socket.id}`);
    }
  });

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
