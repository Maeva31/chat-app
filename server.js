import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

let users = {};           // { username: { id, username, gender, age, role, invisible } }
let messageHistory = {};  // { roomName: [messages...] }
let roomUsers = {};       // { roomName: [{username, id, gender, age, role, invisible}] }
let userChannels = {};    // { socket.id: roomName }
let roomOwners = {};      // { roomName: username propriétaire }
let modData = { admins: [], modos: [] };
let bannedByRoom = {};    // { roomName: Set(pseudos) }
let mutedByRoom = {};     // { roomName: Set(pseudos) }

const defaultRooms = ['Général', 'Musique', 'Gaming', 'Détente'];
let savedRooms = [];

// --- Chargement des modérateurs ---
try {
  const data = fs.readFileSync('moderators.json', 'utf8');
  modData = JSON.parse(data);
} catch (e) {
  console.warn("⚠️ Impossible de charger moderators.json, pas de modérateurs définis.");
}

// --- Chargement des salons enregistrés ---
try {
  const data = fs.readFileSync('rooms.json', 'utf8');
  savedRooms = JSON.parse(data);
} catch {
  savedRooms = [...defaultRooms];
}

// S'assurer d'avoir les salons par défaut toujours présents
savedRooms = [...new Set([...defaultRooms, ...savedRooms])];

// Initialiser les structures pour chaque salon
savedRooms.forEach(room => {
  if (!messageHistory[room]) messageHistory[room] = [];
  if (!roomUsers[room]) roomUsers[room] = [];
  if (!bannedByRoom[room]) bannedByRoom[room] = new Set();
  if (!mutedByRoom[room]) mutedByRoom[room] = new Set();
});

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Helper pour récupérer rôle
function getUserRole(username) {
  if (modData.admins.includes(username)) return 'admin';
  if (modData.modos.includes(username)) return 'modo';
  return 'user';
}

// Sauvegarder les modos/admins
function saveModerators() {
  try {
    fs.writeFileSync('moderators.json', JSON.stringify(modData, null, 2));
  } catch (e) {
    console.error('Erreur sauvegarde moderators.json:', e);
  }
}

// Émettre la liste des utilisateurs visibles dans un salon
function emitUserList(room) {
  if (!roomUsers[room]) return;
  const visibleUsers = roomUsers[room].filter(u => !u.invisible);
  io.to(room).emit('user list', visibleUsers);
}

// Met à jour le nombre d'utilisateurs visibles par salon
function updateRoomUserCounts() {
  const counts = {};
  for (const room of savedRooms) {
    counts[room] = (roomUsers[room]?.filter(u => !u.invisible).length) || 0;
  }
  io.emit('roomUserCounts', counts);
}

// Supprime les salons dynamiques vides
function cleanupEmptyDynamicRooms() {
  for (const room of savedRooms) {
    if (!defaultRooms.includes(room)) {
      if (!roomUsers[room] || roomUsers[room].length === 0) {
        delete messageHistory[room];
        delete roomUsers[room];
        delete bannedByRoom[room];
        delete mutedByRoom[room];
        delete roomOwners[room];
        savedRooms = savedRooms.filter(r => r !== room);
        fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
        console.log(`❌ Salon supprimé (vide) : ${room}`);
        io.emit('room list', savedRooms);
      }
    }
  }
  updateRoomUserCounts();
}

// Démotion d'un modo
function demoteModo(username) {
  if (!users[username]) return false;
  users[username].role = 'user';

  const index = modData.modos.indexOf(username);
  if (index !== -1) {
    modData.modos.splice(index, 1);
    saveModerators();
    return true;
  }
  return false;
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  const defaultChannel = 'Général';
  userChannels[socket.id] = defaultChannel;
  socket.join(defaultChannel);

  socket.emit('chat history', messageHistory[defaultChannel]);
  emitUserList(defaultChannel);
  socket.emit('room list', savedRooms);
  updateRoomUserCounts();

  socket.on('set username', (data) => {
    const { username, gender, age, invisible } = data;

    if (!username || username.length > 16 || /\s/.test(username)) {
      return socket.emit('username error', 'Pseudo invalide (pas d\'espaces, max 16 caractères)');
    }
    if (isNaN(age) || age < 18 || age > 89) {
      return socket.emit('username error', 'Âge invalide (entre 18 et 89 ans)');
    }
    if (!gender) {
      return socket.emit('username error', 'Genre non spécifié');
    }

    // Vérifier bannissements dans tous les salons où l'utilisateur est
    for (const room of savedRooms) {
      if (bannedByRoom[room].has(username)) {
        socket.emit('username error', 'Vous êtes banni dans au moins un salon.');
        socket.emit('redirect', 'https://banned.maevakonnect.fr');
        return;
      }
    }

    if (users[username] && users[username].id !== socket.id) {
      return socket.emit('username exists', username);
    }

    const role = getUserRole(username);
    const userData = { username, gender, age, id: socket.id, role, invisible: !!invisible };
    users[username] = userData;

    const channel = userChannels[socket.id] || defaultChannel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    console.log(`👤 Utilisateur connecté : ${username} (${gender}, ${age} ans) dans #${channel}, rôle=${role}, invisible=${userData.invisible}`);

    emitUserList(channel);
    socket.emit('username accepted', { username, gender, age, role });
    socket.emit('chat history', messageHistory[channel]);
    updateRoomUserCounts();

    if (!userData.invisible) {
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

    const channel = userChannels[socket.id] || defaultChannel;

    // Vérifie si utilisateur banni dans CE salon
    if (bannedByRoom[channel].has(user.username)) {
      socket.emit('error message', 'Vous êtes banni de ce salon.');
      return;
    }

    // Vérifie si muté dans CE salon
    if (mutedByRoom[channel].has(user.username)) {
      socket.emit('error message', 'Vous êtes muté dans ce salon et ne pouvez pas envoyer de messages.');
      return;
    }

    if (msg.message.startsWith('/')) {
      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);

      const isAdmin = user.role === 'admin';
      const isModo = user.role === 'modo';
      const currentRoom = userChannels[socket.id];
      const isOwner = roomOwners[currentRoom] === user.username;
      const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');

      if (targetName === user.username && ['/ban', '/mute', '/kick'].includes(cmd)) {
        socket.emit('error message', `Vous ne pouvez pas vous ${cmd.slice(1)} vous-même.`);
        return;
      }

      switch (cmd) {
        case '/ban':
        case '/kick':
        case '/mute':
        case '/unmute':

          // Propriétaire modère que son salon, modos/admins partout
          if (!(isAdmin || isModo || isOwner)) {
            socket.emit('no permission');
            return;
          }

          if (isOwner && currentRoom !== userChannels[targetUser?.id]) {
            socket.emit('error message', "Vous ne pouvez modérer que dans votre salon propriétaire.");
            return;
          }

          if (!targetUser) {
            socket.emit('error message', 'Utilisateur introuvable.');
            return;
          }

          // Interdiction modos ou propriétaires de modérer admins/modos
          if ((isModo || isOwner) && isTargetProtected) {
            socket.emit('error message', 'Vous ne pouvez pas modérer cet utilisateur.');
            return;
          }

          if (cmd === '/ban') {
            bannedByRoom[currentRoom].add(targetName);

            // Kick forcé vers Général (déplacement)
            if (userChannels[targetUser.id] === currentRoom) {
              userChannels[targetUser.id] = 'Général';
              const s = io.sockets.sockets.get(targetUser.id);
              if (s) {
                s.leave(currentRoom);
                s.join('Général');
                s.emit('chat history', messageHistory['Général']);
                s.emit('joinedRoom', 'Général');
                s.emit('server message', `Vous avez été banni du salon ${currentRoom} et déplacé dans Général.`);
              }
            }

            io.to(currentRoom).emit('server message', `${targetName} a été banni du salon par ${user.username}`);
            console.log(`⚠️ ${user.username} a banni ${targetName} dans ${currentRoom}`);
            return;
          }

          if (cmd === '/kick') {
            // Kick forcé vers Général
            if (userChannels[targetUser.id] === currentRoom) {
              userChannels[targetUser.id] = 'Général';
              const s = io.sockets.sockets.get(targetUser.id);
              if (s) {
                s.leave(currentRoom);
                s.join('Général');
                s.emit('chat history', messageHistory['Général']);
                s.emit('joinedRoom', 'Général');
                s.emit('server message', `Vous avez été expulsé du salon ${currentRoom} et déplacé dans Général.`);
              }
            }

            io.to(currentRoom).emit('server message', `${targetName} a été expulsé du salon par ${user.username}`);
            console.log(`⚠️ ${user.username} a expulsé ${targetName} dans ${currentRoom}`);
            return;
          }

          if (cmd === '/mute') {
            mutedByRoom[currentRoom].add(targetName);
            io.to(currentRoom).emit('server message', `${targetName} a été muté dans ce salon par ${user.username}`);
            console.log(`⚠️ ${user.username} a muté ${targetName} dans ${currentRoom}`);
            return;
          }

          if (cmd === '/unmute') {
            if (mutedByRoom[currentRoom].has(targetName)) {
              mutedByRoom[currentRoom].delete(targetName);
              io.to(currentRoom).emit('server message', `${targetName} a été unmuté dans ce salon par ${user.username}`);
              console.log(`⚠️ ${user.username} a unmuté ${targetName} dans ${currentRoom}`);
            } else {
              socket.emit('error message', `${targetName} n'est pas muté dans ce salon.`);
            }
            return;
          }
          return;

        case '/unban':
          if (!(isAdmin || isModo)) {
            socket.emit('no permission');
            return;
          }
          if (!targetName) {
            socket.emit('error message', 'Usage : /unban <pseudo>');
            return;
          }
          if (bannedByRoom[currentRoom].has(targetName)) {
            bannedByRoom[currentRoom].delete(targetName);
            io.to(currentRoom).emit('server message', `${targetName} a été débanni du salon par ${user.username}`);
            console.log(`⚠️ ${user.username} a débanni ${targetName} dans ${currentRoom}`);
          } else {
            socket.emit('error message', `${targetName} n'est pas banni dans ce salon.`);
          }
          return;

        case '/addmodo':
          if (!isAdmin) {
            socket.emit('error message', 'Seuls les administrateurs peuvent ajouter des modérateurs.');
            return;
          }
          if (!targetUser) {
            socket.emit('error message', 'Utilisateur introuvable.');
            return;
          }
          if (modData.modos.includes(targetName)) {
            socket.emit('error message', `${targetName} est déjà modérateur.`);
            return;
          }
          if (modData.admins.includes(targetName)) {
            socket.emit('error message', `${targetName} est administrateur et ne peut pas être promu modo.`);
            return;
          }
          modData.modos.push(targetName);
          saveModerators();
          if (users[targetName]) {
            users[targetName].role = 'modo';
            io.to(users[targetName].id).emit('server message', 'Vous avez été promu modérateur.');
          }
          io.emit('server message', `${targetName} a été promu modérateur par ${user.username}`);
          console.log(`⚠️ ${user.username} a promu ${targetName} en modérateur`);
          return;

        case '/removemodo':
          if (!isAdmin) {
            socket.emit('error message', 'Seuls les administrateurs peuvent retirer des modérateurs.');
            return;
          }
          if (!targetName) {
            socket.emit('error message', 'Usage : /removemodo <pseudo>');
            return;
          }
          if (!targetUser) {
            socket.emit('error message', `L'utilisateur ${targetName} n'existe pas.`);
            return;
          }
          if (!modData.modos.includes(targetName)) {
            socket.emit('error message', `L'utilisateur ${targetName} n'est pas modérateur.`);
            return;
          }
          const success = demoteModo(targetName);
          if (success) {
            io.emit('server message', `${targetName} n'est plus modérateur.`);
            io.emit('user list', Object.values(users));
            console.log(`⚠️ ${user.username} a retiré ${targetName} du statut modérateur`);
          } else {
            socket.emit('error message', 'Impossible de retirer ce modérateur.');
          }
          return;

        case '/invisible':
          if (user.role !== 'admin') {
            socket.emit('error message', 'Commande /invisible réservée aux administrateurs.');
            return;
          }
          if (args.length < 2) {
            socket.emit('error message', 'Usage : /invisible on | off');
            return;
          }
          const param = args[1].toLowerCase();
          if (param === 'on') {
            user.invisible = true;
            if (roomUsers[currentRoom]) {
              const u = roomUsers[currentRoom].find(u => u.id === socket.id);
              if (u) u.invisible = true;
            }
            socket.emit('server message', 'Mode invisible activé.');
            console.log(`🔍 ${user.username} a activé le mode invisible.`);
            emitUserList(currentRoom);
            updateRoomUserCounts();
          } else if (param === 'off') {
            user.invisible = false;
            if (roomUsers[currentRoom]) {
              const u = roomUsers[currentRoom].find(u => u.id === socket.id);
              if (u) u.invisible = false;
            }
            socket.emit('server message', 'Mode invisible désactivé.');
            console.log(`🔍 ${user.username} a désactivé le mode invisible.`);
            emitUserList(currentRoom);
            updateRoomUserCounts();
            io.to(currentRoom).emit('chat message', {
              username: 'Système',
              message: `${user.username} est maintenant visible.`,
              timestamp: new Date().toISOString(),
              channel: currentRoom
            });
          } else {
            socket.emit('error message', 'Paramètre invalide. Usage : /invisible on | off');
          }
          return;

        case '/closeRoom':
          if (!roomOwners[currentRoom]) {
            socket.emit('error message', 'Ce salon ne peut pas être fermé.');
            return;
          }
          if (roomOwners[currentRoom] !== user.username) {
            socket.emit('error message', 'Vous n\'êtes pas le propriétaire de ce salon.');
            return;
          }
          if (defaultRooms.includes(currentRoom)) {
            socket.emit('error message', 'Les salons par défaut ne peuvent pas être fermés.');
            return;
          }

          const usersToMove = roomUsers[currentRoom] || [];
          for (const u of usersToMove) {
            userChannels[u.id] = 'Général';
            const s = io.sockets.sockets.get(u.id);
            if (s) {
              s.leave(currentRoom);
              s.join('Général');
              s.emit('chat history', messageHistory['Général']);
              s.emit('joinedRoom', 'Général');
            }
          }

          delete messageHistory[currentRoom];
          delete roomUsers[currentRoom];
          delete bannedByRoom[currentRoom];
          delete mutedByRoom[currentRoom];
          savedRooms = savedRooms.filter(r => r !== currentRoom);
          delete roomOwners[currentRoom];
          fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
          io.emit('room list', savedRooms);
          io.emit('server message', `Le salon ${currentRoom} a été fermé par ${user.username}`);
          console.log(`❌ Salon fermé : ${currentRoom} par ${user.username}`);
          updateRoomUserCounts();
          return;

        default:
          socket.emit('error message', `Commande inconnue : ${cmd}`);
          return;
      }
    }

    // Message normal, on stocke dans l'historique
    const messageEntry = {
      username: user.username,
      message: msg.message,
      timestamp: new Date().toISOString(),
      channel: channel,
      role: user.role,
    };

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(messageEntry);
    if (messageHistory[channel].length > MAX_HISTORY) messageHistory[channel].shift();

    io.to(channel).emit('chat message', messageEntry);
  });

  socket.on('joinRoom', (newChannel) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    if (!savedRooms.includes(newChannel)) {
      socket.emit('error message', 'Le salon demandé n\'existe pas.');
      return;
    }

    const oldChannel = userChannels[socket.id] || defaultChannel;

    // Vérifier si banni dans le nouveau salon
    if (bannedByRoom[newChannel].has(user.username)) {
      socket.emit('error message', 'Vous êtes banni de ce salon.');
      return;
    }

    socket.leave(oldChannel);
    socket.join(newChannel);

    userChannels[socket.id] = newChannel;

    if (!roomUsers[oldChannel]) roomUsers[oldChannel] = [];
    if (!roomUsers[newChannel]) roomUsers[newChannel] = [];

    // Retirer user de l'ancien salon
    roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);

    // Ajouter user au nouveau salon
    roomUsers[newChannel].push(user);

    if (!user.invisible) {
      io.to(newChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a rejoint le salon ${newChannel}`,
        timestamp: new Date().toISOString(),
        channel: newChannel
      });
      io.to(oldChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon ${oldChannel}`,
        timestamp: new Date().toISOString(),
        channel: oldChannel
      });
    }

    socket.emit('chat history', messageHistory[newChannel]);
    emitUserList(newChannel);
    emitUserList(oldChannel);
    updateRoomUserCounts();
  });

  socket.on('createRoom', (roomName) => {
    if (typeof roomName !== 'string') {
      socket.emit('error message', 'Nom de salon invalide.');
      return;
    }
    roomName = roomName.trim();

    if (savedRooms.includes(roomName)) {
      socket.emit('error message', 'Ce salon existe déjà.');
      return;
    }
    if (roomName.length > 20 || /\s/.test(roomName)) {
      socket.emit('error message', 'Nom de salon invalide (pas d\'espaces, max 20 caractères).');
      return;
    }
    if (savedRooms.length >= MAX_ROOMS) {
      socket.emit('error message', 'Nombre maximal de salons atteint.');
      return;
    }

    savedRooms.push(roomName);
    messageHistory[roomName] = [];
    roomUsers[roomName] = [];
    bannedByRoom[roomName] = new Set();
    mutedByRoom[roomName] = new Set();

    // Le créateur du salon est propriétaire
    const owner = Object.values(users).find(u => u.id === socket.id);
    roomOwners[roomName] = owner ? owner.username : '';

    fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
    io.emit('room list', savedRooms);
    io.emit('server message', `Le salon ${roomName} a été créé par ${roomOwners[roomName]}`);
    console.log(`🆕 Salon créé : ${roomName} par ${roomOwners[roomName]}`);
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const channel = userChannels[socket.id] || defaultChannel;

    if (roomUsers[channel]) {
      roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
      emitUserList(channel);
    }
    delete users[user.username];
    delete userChannels[socket.id];

    if (!user.invisible) {
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon ${channel}`,
        timestamp: new Date().toISOString(),
        channel
      });
    }

    cleanupEmptyDynamicRooms();
    updateRoomUserCounts();

    console.log(`⛔ Déconnexion : ${user.username}`);
  });
});

server.listen(3000, () => {
  console.log('🚀 Serveur démarré sur le port 3000');
});
