import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

let users = {};           // { username: { id, username, gender, age, role, banned, muted, invisible } }
let messageHistory = {};
let roomUsers = {};
let userChannels = {};
let bannedUsers = new Set();   // pseudos bannis
let mutedUsers = new Set();    // pseudos mutés

// Propriétaires des salons créés (salon => username)
let roomOwners = {};

// Chargement des modérateurs
let modData = { admins: [], modos: [] };
try {
  const data = fs.readFileSync('moderators.json', 'utf-8');
  modData = JSON.parse(data);
} catch (e) {
  console.warn("⚠️ Impossible de charger moderators.json, pas de modérateurs définis.");
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

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

function getUserRole(username) {
  if (modData.admins.includes(username)) return 'admin';
  if (modData.modos.includes(username)) return 'modo';
  return 'user';
}

function saveModerators() {
  try {
    fs.writeFileSync('moderators.json', JSON.stringify(modData, null, 2));
  } catch (e) {
    console.error('Erreur lors de la sauvegarde de moderators.json :', e);
  }
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
        // Supprimer propriétaire du salon
        delete roomOwners[room];
        fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
        console.log(`❌ Salon supprimé (vide) : ${room}`);
        io.emit('room list', savedRooms);
      }
    }
  }
  updateRoomUserCounts();
}

// Fonction utilitaire pour retirer un modo
function demoteModo(username) {
  if (!users[username]) return false;

  // Remettre rôle user en mémoire serveur
  users[username].role = 'user';

  // Retirer de la liste modos JSON
  const index = modData.modos.indexOf(username);
  if (index !== -1) {
    modData.modos.splice(index, 1);
    saveModerators();
    return true;
  }
  return false;
}

io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

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
    const { username, gender, age, invisible } = data;

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

    const invisibleFromClient = invisible === true;
    const prevInvisible = users[username]?.invisible ?? invisibleFromClient;

    const role = getUserRole(username);
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
      socket.emit('redirect', 'https://banned.maevakonnect.fr');
      return;
    }

    if (mutedUsers.has(user.username)) {
      socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages.');
      return;
    }

    if (msg.message.startsWith('/')) {
      // Gestion commandes avec vérification des droits propriétaires/modo/admin

      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);

      // Utilisateur est admin ou modo
      const isAdmin = user.role === 'admin';
      const isModo = user.role === 'modo';

      // Salle actuelle
      const currentRoom = userChannels[socket.id];

      // Vérifier si user est proprio du salon (salon dynamique uniquement)
      const isOwner = roomOwners[currentRoom] === user.username;

      // Protection rôles des cibles
      const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');

      // Interdire auto ban/mute/kick
      if (targetName === user.username && ['/ban', '/mute', '/kick'].includes(cmd)) {
        socket.emit('error message', `Vous ne pouvez pas vous ${cmd.slice(1)} vous-même.`);
        return;
      }

      if (['/ban', '/kick', '/mute', '/unmute'].includes(cmd)) {
        if (!isAdmin && !isModo && !isOwner) {
          socket.emit('no permission');
          return;
        }

        if (!targetUser) {
          socket.emit('error message', 'Utilisateur introuvable.');
          return;
        }

        if (isOwner) {
          // Le proprio modère uniquement dans son salon propriétaire
          if (roomOwners[currentRoom] !== user.username) {
            socket.emit('error message', "Vous ne pouvez modérer que dans votre salon propriétaire.");
            return;
          }
          // La cible doit être dans ce même salon
          const targetChannel = userChannels[targetUser.id];
          if (targetChannel !== currentRoom) {
            socket.emit('error message', "Vous ne pouvez modérer que les utilisateurs présents dans votre salon.");
            return;
          }
          // Proprio ne peut pas modérer admin ou modo
          if (targetUser.role === 'admin' || targetUser.role === 'modo') {
            socket.emit('error message', 'Vous ne pouvez pas modérer un admin ou modo.');
            return;
          }
        }

        if (isModo) {
          // Modo ne peut modérer ni admin ni modo
          if (targetUser.role === 'admin' || targetUser.role === 'modo') {
            socket.emit('error message', 'Vous ne pouvez pas modérer cet utilisateur.');
            return;
          }
        }

        switch (cmd) {
          case '/ban':
            bannedUsers.add(targetName);
            io.to(targetUser.id).emit('banned');
            io.to(targetUser.id).emit('redirect', 'https://banned.maevakonnect.fr');
            setTimeout(() => {
              io.sockets.sockets.get(targetUser.id)?.disconnect(true);
            }, 1500);
            io.emit('server message', `${targetName} a été banni par ${user.username}`);
            console.log(`⚠️ ${user.username} a banni ${targetName}`);
            return;

          case '/kick':
            io.to(targetUser.id).emit('kicked');
            io.to(targetUser.id).emit('redirect', 'https://maevakonnect.fr');
            setTimeout(() => {
              io.sockets.sockets.get(targetUser.id)?.disconnect(true);
            }, 1500);
            io.emit('server message', `${targetName} a été expulsé par ${user.username}`);
            console.log(`⚠️ ${user.username} a expulsé ${targetName}`);
            return;

          case '/mute':
            mutedUsers.add(targetName);
            io.to(targetUser.id).emit('muted');
            io.emit('server message', `${targetName} a été muté par ${user.username}`);
            console.log(`⚠️ ${user.username} a muté ${targetName}`);
            return;

          case '/unmute':
            if (mutedUsers.has(targetName)) {
              mutedUsers.delete(targetName);
              io.to(targetUser.id).emit('unmuted');
              io.emit('server message', `${targetName} a été unmuté par ${user.username}`);
              console.log(`⚠️ ${user.username} a unmuté ${targetName}`);
            } else {
              socket.emit('error message', `${targetName} n'est pas muté.`);
            }
            return;
        }
      }

      if (cmd === '/unban') {
        if (!isAdmin && !isModo) {
          socket.emit('no permission');
          return;
        }
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
      }

      // Nouvelle commande /addmodo uniquement admin
      if (cmd === '/addmodo') {
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
        // Mise à jour rôle dans users
        if (users[targetName]) {
          users[targetName].role = 'modo';
          io.to(users[targetName].id).emit('server message', 'Vous avez été promu modérateur.');
        }
        io.emit('server message', `${targetName} a été promu modérateur par ${user.username}`);
        console.log(`⚠️ ${user.username} a promu ${targetName} en modérateur`);
        return;
      }

      // Nouvelle commande /removemodo uniquement admin
      if (cmd === '/removemodo') {
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
      }

      if (cmd === '/invisible') {
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
      }

      if (cmd === '/closeRoom') {
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
        savedRooms = savedRooms.filter(r => r !== currentRoom);
        delete roomOwners[currentRoom];
        fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));

        io.emit('room list', savedRooms);
        updateRoomUserCounts();
        io.emit('server message', `Le salon ${currentRoom} a été fermé par ${user.username}`);
        console.log(`❌ Salon fermé par ${user.username} : ${currentRoom}`);
        return;
      }

      socket.emit('error message', 'Commande inconnue.');
      return;
    }

    // Message classique
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

  socket.on('joinRoom', (newChannel) => {
    if (typeof newChannel !== 'string' || !newChannel.trim() || newChannel.length > 20 || /\s/.test(newChannel)) {
      return socket.emit('error message', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
    }

    const oldChannel = userChannels[socket.id] || defaultChannel;
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    if (oldChannel === newChannel) return;

    // Créer le salon s'il n'existe pas et limite atteinte
    if (!savedRooms.includes(newChannel)) {
      if (savedRooms.length >= MAX_ROOMS) {
        return socket.emit('error message', 'Nombre maximal de salons atteints.');
      }
      savedRooms.push(newChannel);
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      roomOwners[newChannel] = user.username; // Propriétaire = utilisateur
      fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
      io.emit('room list', savedRooms);
      io.emit('server message', `Le salon ${newChannel} a été créé par ${user.username}`);
      console.log(`➕ Salon créé par ${user.username} : ${newChannel}`);
    }

    // Quitter ancien salon
    socket.leave(oldChannel);
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      if (!user.invisible) {
        io.to(oldChannel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a quitté le salon.`,
          timestamp: new Date().toISOString(),
          channel: oldChannel
        });
      }
      emitUserList(oldChannel);
    }

    // Rejoindre nouveau salon
    socket.join(newChannel);
    userChannels[socket.id] = newChannel;

    if (!roomUsers[newChannel]) roomUsers[newChannel] = [];
    roomUsers[newChannel].push(user);

    if (!user.invisible) {
      io.to(newChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a rejoint le salon.`,
        timestamp: new Date().toISOString(),
        channel: newChannel
      });
    }

    emitUserList(newChannel);
    socket.emit('chat history', messageHistory[newChannel]);
    socket.emit('joinedRoom', newChannel);
    updateRoomUserCounts();

    cleanupEmptyDynamicRooms();
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const channel = userChannels[socket.id];
    if (channel && roomUsers[channel]) {
      roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
      if (!user.invisible) {
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a quitté le serveur.`,
          timestamp: new Date().toISOString(),
          channel
        });
      }
      emitUserList(channel);
      updateRoomUserCounts();

      cleanupEmptyDynamicRooms();
    }

    delete users[user.username];
    delete userChannels[socket.id];

    console.log(`❌ Déconnexion : ${user.username} (${socket.id})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
