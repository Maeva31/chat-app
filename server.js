import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import configureMicrophone from './microphoneManager.js';

const app = express();

// Ajout header pour autoriser microphone
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self)');
  next();
});

const server = http.createServer(app);
const io = new Server(server);

configureMicrophone(io);

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

const defaultRooms = ['Général', 'Musique', 'Gaming', 'Détente'];
let savedRooms = [];
try {
  const data = fs.readFileSync('rooms.json', 'utf-8');
  savedRooms = JSON.parse(data);
} catch {
  savedRooms = [...defaultRooms];
}

savedRooms = [...new Set([...defaultRooms, ...savedRooms])];
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


function getUserRole(username) {
  if (modData.admins.includes(username)) return 'admin';
  if (modData.modos.includes(username)) return 'modo';
  return 'user';
}

// Fonction pour vérifier si un utilisateur a besoin d'un mot de passe
function requiresPassword(username) {
  const role = getUserRole(username);
  return (role === 'admin' || role === 'modo') && passwords[username];
}

function updateRoomUserCounts() {
  const counts = {};
  for (const [channel, list] of Object.entries(roomUsers)) {
    counts[channel] = list.filter(u => !u.invisible).length;
  }
  io.emit('roomUserCounts', counts);
}

// Envoie la liste des utilisateurs en excluant les invisibles
function emitUserList(channel) {
  if (!roomUsers[channel]) return;
  // Exclure les users invisibles
  const visibleUsers = roomUsers[channel].filter(u => !u.invisible);
  io.to(channel).emit('user list', visibleUsers);
}

function cleanupEmptyDynamicRooms() {
  for (const room of savedRooms) {
    if (!defaultRooms.includes(room)) {
      if (roomUsers[room] && roomUsers[room].length === 0) {
        delete messageHistory[room];
        delete roomUsers[room];
        savedRooms = savedRooms.filter(r => r !== room);
        fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
        console.log(`❌ Salon supprimé (vide) : ${room}`);
        io.emit('room list', savedRooms);
      }
    }
  }
  updateRoomUserCounts();
}

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

      // Retirer l'utilisateur de la liste des utilisateurs dans la salle
      if (roomUsers[room]) {
        roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
        emitUserList(room);
      }
    }

    // Supprimer l'utilisateur et ses infos
    delete users[user.username];
    delete userChannels[socket.id];

    // Déconnecter le socket proprement
    socket.disconnect(true);

    // Nettoyer les salons dynamiques vides si besoin
    cleanupEmptyDynamicRooms();

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
  emitUserList(defaultChannel);
  socket.emit('room list', savedRooms);
  updateRoomUserCounts();

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
      socket.emit('redirect', 'https://banned.maevakonnect.fr'); // Redirection vers page bannis
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      return socket.emit('username exists', username);
    }

    // VÉRIFICATION : Mot de passe pour les rôles privilégiés
    if (requiresPassword(username)) {
      if (!password) {
        return socket.emit('password required', username);
      }
      if (passwords[username] !== password) {
        return socket.emit('password error', 'Mot de passe incorrect pour ce compte privilégié.');
      }
      console.log(`🔐 Authentification réussie pour ${username}`);
    }

    // Récupérer invisible si l'utilisateur existait déjà
    const invisibleFromClient = invisible === true;
    const prevInvisible = users[username]?.invisible ?? invisibleFromClient;

    const role = getUserRole(username);
    // Par défaut invisible = false, sauf si récupéré
    const userData = { username, gender, age, id: socket.id, role, banned: false, muted: false, invisible: prevInvisible };
    users[username] = userData;

    let channel = userChannels[socket.id] || defaultChannel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    console.log(`👤 Connecté : ${username} (${gender}, ${age} ans) dans #${channel} rôle=${role} invisible=${userData.invisible}`);

    emitUserList(channel);
    socket.emit('username accepted', { username, gender, age });
    socket.emit('chat history', messageHistory[channel]);
    updateRoomUserCounts();

    // Message système : a rejoint le salon (après actualisation) uniquement si non invisible
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

    if (bannedUsers.has(user.username)) {
      socket.emit('error message', 'Vous êtes banni du serveur.');
      socket.emit('redirect', 'https://banned.maevakonnect.fr');  // Redirection bannis si tente envoyer message
      return;
    }

    if (mutedUsers.has(user.username)) {
      socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages.');
      // suppression de la redirection pour mute
      return;
    }

    // Gestion commande admin/modo (inclut la nouvelle commande /invisible)
    if (msg.message.startsWith('/')) {
      if (user.role !== 'admin' && user.role !== 'modo') {
        socket.emit('no permission');
        return;
      }

      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);

      // Protection rôles
      const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');
      const isUserModo = user.role === 'modo';

      switch (cmd) {
        case '/ban':
  if (!targetUser) {
    socket.emit('error message', 'Utilisateur introuvable.');
    return;
  }

  // Interdiction de se bannir soi-même (modo ou admin)
  if (targetName === user.username) {
    socket.emit('error message', 'Vous ne pouvez pas vous bannir vous-même.');
    return;
  }

  const isUserModo = user.role === 'modo';
  const isTargetProtected = targetUser.role === 'admin' || targetUser.role === 'modo';

  // Les modos ne peuvent pas bannir d'autres modos/admins
  if (isUserModo && isTargetProtected) {
    socket.emit('error message', 'Vous ne pouvez pas bannir cet utilisateur.');
    return;
  }

  bannedUsers.add(targetName);
  io.to(targetUser.id).emit('banned');
  io.to(targetUser.id).emit('redirect', 'https://banned.maevakonnect.fr'); // Redirection bannis sur ban
  setTimeout(() => {
    io.sockets.sockets.get(targetUser.id)?.disconnect(true);
  }, 1500);
  io.emit('server message', `${targetName} a été banni par ${user.username}`);
  console.log(`⚠️ ${user.username} a banni ${targetName}`);
  return;

case '/kick':
  if (!targetUser) {
    socket.emit('error message', 'Utilisateur introuvable.');
    return;
  }

  // Interdiction de se kicker soi-même (modo ou admin)
  if (targetName === user.username) {
    socket.emit('error message', 'Vous ne pouvez pas vous expulser vous-même.');
    return;
  }

  const isUserModoKick = user.role === 'modo';
  const isTargetProtectedKick = targetUser.role === 'admin' || targetUser.role === 'modo';

  // Les modos ne peuvent pas kicker d'autres modos/admins
  if (isUserModoKick && isTargetProtectedKick) {
    socket.emit('error message', 'Vous ne pouvez pas expulser cet utilisateur.');
    return;
  }

  io.to(targetUser.id).emit('kicked');
  io.to(targetUser.id).emit('redirect', 'https://maevakonnect.fr'); // Redirection kick
  setTimeout(() => {
    io.sockets.sockets.get(targetUser.id)?.disconnect(true);
  }, 1500);
  io.emit('server message', `${targetName} a été expulsé par ${user.username}`);
  console.log(`⚠️ ${user.username} a expulsé ${targetName}`);
  return;

case '/mute':
  if (!targetUser) {
    socket.emit('error message', 'Utilisateur introuvable.');
    return;
  }

  // Interdiction de se muter soi-même (modo ou admin)
  if (targetName === user.username) {
    socket.emit('error message', 'Vous ne pouvez pas vous muter vous-même.');
    return;
  }

  const isUserModoMute = user.role === 'modo';
  const isTargetProtectedMute = targetUser.role === 'admin' || targetUser.role === 'modo';

  // Les modos ne peuvent pas muter d'autres modos/admins
  if (isUserModoMute && isTargetProtectedMute) {
    socket.emit('error message', 'Vous ne pouvez pas muter cet utilisateur.');
    return;
  }

  mutedUsers.add(targetName);
  io.to(targetUser.id).emit('muted');
  io.emit('server message', `${targetName} a été muté par ${user.username}`);
  console.log(`⚠️ ${user.username} a muté ${targetName}`);
  return;


        case '/unban':
          if (!targetUser) {
            socket.emit('error message', 'Utilisateur introuvable.');
            return;
          }
          if (bannedUsers.has(targetName)) {
            bannedUsers.delete(targetName);
            io.emit('server message', `${targetName} a été débanni par ${user.username}`);
            console.log(`⚠️ ${user.username} a débanni ${targetName}`);
          } else {
            socket.emit('error message', `${targetName} n'est pas banni.`);
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
          const channel = userChannels[socket.id];
          if (param === 'on') {
            user.invisible = true;
            if (roomUsers[channel]) {
              const u = roomUsers[channel].find(u => u.id === socket.id);
              if (u) u.invisible = true;
            }
            socket.emit('server message', 'Mode invisible activé.');
            console.log(`🔍 ${user.username} a activé le mode invisible.`);
            emitUserList(channel);
            updateRoomUserCounts();
          } else if (param === 'off') {
            user.invisible = false;
            if (roomUsers[channel]) {
              const u = roomUsers[channel].find(u => u.id === socket.id);
              if (u) u.invisible = false;
            }
            socket.emit('server message', 'Mode invisible désactivé.');
            console.log(`🔍 ${user.username} a désactivé le mode invisible.`);
            emitUserList(channel);
            updateRoomUserCounts();
            io.to(channel).emit('chat message', {
              username: 'Système',
              message: `${user.username} est maintenant visible.`,
              timestamp: new Date().toISOString(),
              channel
            });
          } else {
            socket.emit('error message', 'Paramètre invalide. Usage : /invisible on | off');
          }
          return;

        default:
          socket.emit('error message', 'Commande inconnue.');
          return;
      }
    }

    const message = {
  username: user.username,
  gender: user.gender,
  role: user.role,
  message: msg.message || '',
  timestamp: msg.timestamp || new Date().toISOString(),
  channel,
  style: msg.style || {} 
};


    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(message);
    if (messageHistory[channel].length > MAX_HISTORY) {
      messageHistory[channel].shift();
    }

    io.to(channel).emit('chat message', message);
  });

  socket.on('joinRoom', (newChannel) => {
    if (typeof newChannel !== 'string' || !newChannel.trim()) {
      return socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
    }

    const oldChannel = userChannels[socket.id] || defaultChannel;
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    if (!messageHistory[newChannel]) messageHistory[newChannel] = [];
    if (!roomUsers[newChannel]) roomUsers[newChannel] = [];

    if (oldChannel !== newChannel) {
      socket.leave(oldChannel);
      if (roomUsers[oldChannel]) {
        roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
        emitUserList(oldChannel);
      }

      userChannels[socket.id] = newChannel;
      socket.join(newChannel);

      roomUsers[newChannel] = roomUsers[newChannel].filter(u => u.id !== socket.id);
      roomUsers[newChannel].push(user);

      // Message système uniquement si non invisible
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
    } else {
      if (!roomUsers[newChannel].some(u => u.id === socket.id)) {
        roomUsers[newChannel].push(user);
      }
    }

    socket.emit('chat history', messageHistory[newChannel]);
    emitUserList(newChannel);
    socket.emit('joinedRoom', newChannel);
    updateRoomUserCounts();
    cleanupEmptyDynamicRooms();
  });

  socket.on('createRoom', (newChannel) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    if (mutedUsers.has(user.username)) {
      socket.emit('error', 'Vous êtes muté et ne pouvez pas créer de salons.');
      // Retiré la ligne de redirection
      return;
    }

    if (typeof newChannel !== 'string' || !newChannel.trim() || newChannel.length > 20 || /\s/.test(newChannel)) {
      return socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
    }

    if (savedRooms.includes(newChannel)) {
      return socket.emit('room exists', newChannel);
    }

    if (savedRooms.length >= MAX_ROOMS) {
      return socket.emit('error', 'Nombre maximum de salons atteint.');
    }

    messageHistory[newChannel] = [];
    roomUsers[newChannel] = [];
    savedRooms.push(newChannel);
    savedRooms = [...new Set(savedRooms)];

    fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
    console.log(`🆕 Salon créé : ${newChannel}`);

    const oldChannel = userChannels[socket.id];
    if (oldChannel && oldChannel !== newChannel) {
      socket.leave(oldChannel);
      if (roomUsers[oldChannel]) {
        roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
        emitUserList(oldChannel);
      }

      io.to(oldChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon ${oldChannel}`,
        timestamp: new Date().toISOString(),
        channel: oldChannel
      });
    }

    userChannels[socket.id] = newChannel;
    socket.join(newChannel);
    roomUsers[newChannel].push(user);
    console.log(`${user.username} a rejoint le salon ${newChannel}`);

    socket.emit('room created', newChannel);
    io.emit('room list', savedRooms);
    updateRoomUserCounts();

    socket.emit('chat history', messageHistory[newChannel]);

    io.to(newChannel).emit('chat message', {
      username: 'Système',
      message: `Bienvenue dans le salon ${newChannel}!`,
      timestamp: new Date().toISOString(),
      channel: newChannel
    });

    emitUserList(newChannel);

    socket.emit('joinedRoom', newChannel);
    cleanupEmptyDynamicRooms();
  });

  socket.on('request history', (roomName) => {
    if (roomName && messageHistory[roomName]) {
      socket.emit('chat history', messageHistory[roomName]);
    }
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
        emitUserList(channel);
      }

      delete users[user.username];
      delete userChannels[socket.id];

      cleanupEmptyDynamicRooms();
    } else {
      console.log(`❌ Déconnexion inconnue : ${socket.id}`);
    }
  });
  

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
