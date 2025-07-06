import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import multer from 'multer';



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 20e6 // autorise jusqu’à 20 Mo par message
});


const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

let users = {};           // { username: { id, username, gender, age, role, banned, muted, invisible } }
let messageHistory = {};
let roomUsers = {};
let userChannels = {};
let bannedUsers = new Set();   // pseudos bannis (simple set, pour persister on peut ajouter fichier json)
let mutedUsers = new Set();    // pseudos mutés
// Rôles temporaires locaux par salon (admin/modo)
const localRoles = {}; // { roomName: { admins: Set, modos: Set, bans: Map, kicks: Map, mutes: Set } }

// Chargement des modérateurs
let modData = { admins: [], modos: [] };
try {
  const data = fs.readFileSync('moderators.json', 'utf-8');
  modData = JSON.parse(data);
} catch (e) {
  console.warn("⚠️ Impossible de charger moderators.json, pas de modérateurs définis.");
}

// <-- Ici, ajoute la déclaration de tempMods
const tempMods = {
  admins: new Set(),
  modos: new Set()
};


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
  if (modData.admins.includes(username) || tempMods.admins.has(username)) return 'admin';
  if (modData.modos.includes(username) || tempMods.modos.has(username)) return 'modo';
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

function getLocalRole(username, room) {
  if (!localRoles[room]) return 'user';
  if (localRoles[room].admins.has(username)) return 'admin';
  if (localRoles[room].modos.has(username)) return 'modo';
  return 'user';
}

function isLocalAdmin(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  return user && getLocalRole(user.username, room) === 'admin';
}

function isLocalModo(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  const role = getLocalRole(user.username, room);
  return user && (role === 'admin' || role === 'modo');
}


function cleanupEmptyDynamicRooms() {
  for (const room of savedRooms) {
    if (!defaultRooms.includes(room)) {
      if (roomUsers[room] && roomUsers[room].length === 0) {
  if (localRoles[room]) {
    delete localRoles[room];
    console.log(`🧹 Rôles locaux supprimés pour ${room}`);
  }

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

const UPLOAD_DIR = path.resolve('./public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Type de fichier non autorisé'));
  }
});

app.post('/upload', upload.single('file'), (req, res) => {
  const userId = req.body.userId; // id socket ou username
  const room = req.body.room;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;

  // Envoi message dans le salon via Socket.IO
  if (userId && room && io.sockets.sockets.has(userId)) {
    const userSocket = io.sockets.sockets.get(userId);
    const user = Object.values(users).find(u => u.id === userId);

    const message = {
  username: user ? user.username : 'Utilisateur',
  gender: user ? user.gender : 'non spécifié',
  role: user ? user.role : 'user',
  message: '',
  file: fileUrl,
  timestamp: new Date().toISOString(),
  channel: room,
};


    if (!messageHistory[room]) messageHistory[room] = [];
    messageHistory[room].push(message);
    if (messageHistory[room].length > MAX_HISTORY) messageHistory[room].shift();

    io.to(room).emit('chat message', message);

    res.json({ success: true, url: fileUrl });
  } else {
    res.status(400).json({ error: 'Informations utilisateur ou salon manquantes ou invalides' });
  }
});




io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

  socket.on('upload file', ({ filename, mimetype, data, channel, timestamp }) => {
    if (!channel || !savedRooms.includes(channel)) {
      socket.emit('error message', 'Salon invalide pour upload de fichier.');
      return;
    }

    // Recherche l'utilisateur AVANT d'émettre
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    // Émet avec role et gender
    io.to(channel).emit('file uploaded', {
      username: user.username,
      role: user.role,
      gender: user.gender,
      filename,
      data,
      mimetype,
      timestamp: timestamp || new Date().toISOString()
    });
  });



 function logout(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) {
    console.log(`Logout : utilisateur non trouvé pour socket ${socket.id}`);
    return;
  }

  // Supprimer les rôles temporaires
  tempMods.admins.delete(user.username);
  tempMods.modos.delete(user.username);

  // ... le reste de la fonction logout (messages, nettoyage, etc.)

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
      emitUserList(room);
    }
  }

  delete users[user.username];
  delete userChannels[socket.id];

  socket.disconnect(true);

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
    // --- IMPORTS ---
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 20e6 // autorise jusqu’à 20 Mo par message
});

// --- DONNÉES ---
const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

const users = {};
const userChannels = {};
const roomUsers = {};
const messageHistory = {};
let savedRooms = ['Général', 'Musique', 'Gaming'];
const mutedUsers = new Set();
const bannedUsers = new Set();

const passwords = JSON.parse(fs.readFileSync('./passwords.json'));

const modData = {
  modos: [],
  admins: []
};

const tempMods = {
  modos: new Set(),
  admins: new Set()
};

const localRoles = {};

// --- OUTILS ---
function emitUserList(channel) {
  const visibleUsers = (roomUsers[channel] || []).filter(u => !u.invisible);
  io.to(channel).emit('user list', visibleUsers);
}

function updateRoomUserCounts() {
  const counts = {};
  for (const [room, users] of Object.entries(roomUsers)) {
    counts[room] = users.filter(u => !u.invisible).length;
  }
  io.emit('room counts', counts);
}

function cleanupEmptyDynamicRooms() {
  for (const room of Object.keys(roomUsers)) {
    if (!savedRooms.includes(room) && roomUsers[room]?.length === 0) {
      delete roomUsers[room];
      delete messageHistory[room];
      delete localRoles[room];
    }
  }
}

function isLocalAdmin(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  return localRoles[room]?.admins?.has(user.username);
}

function isLocalModo(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  return localRoles[room]?.modos?.has(user.username);
}

function getLocalRole(username, room) {
  if (localRoles[room]?.admins?.has(username)) return 'admin';
  if (localRoles[room]?.modos?.has(username)) return 'modo';
  return null;
}

function getUserRole(username) {
  if (modData.admins.includes(username) || tempMods.admins.has(username)) return 'admin';
  if (modData.modos.includes(username) || tempMods.modos.has(username)) return 'modo';
  return 'user';
}

// --- SOCKET ---
io.on('connection', (socket) => {

  socket.on('chat message', (msg) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const channel = userChannels[socket.id];
    if (!channel) return;

    if (msg.message.startsWith('/')) {
      const userRoom = userChannels[socket.id] || 'Général';
      const isGlobalAdminOrModo = user.role === 'admin' || user.role === 'modo';

      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);
      const targetUserRoom = targetUser ? userChannels[targetUser.id] : null;
      const now = Date.now();

      if (['/kick', '/ban', '/mute', '/unmute', '/addmodo', '/remove'].includes(cmd)) {
        if (!isGlobalAdminOrModo && !isLocalModo(socket)) {
          socket.emit('error message', "Vous n'avez pas les droits pour cette commande.");
          return;
        }

        if (!targetUser || !targetUserRoom) {
          socket.emit('error message', "Utilisateur introuvable.");
          return;
        }

        if (!isGlobalAdminOrModo && targetUserRoom !== userRoom) {
          socket.emit('error message', "Utilisateur introuvable dans ce salon.");
          return;
        }

        const isActingModo = getLocalRole(user.username, userRoom) === 'modo';
        const isTargetAdminLocal = getLocalRole(targetName, userRoom) === 'admin';
        if (isActingModo && isTargetAdminLocal) {
          socket.emit('error message', "Vous ne pouvez pas agir sur l'administrateur du salon.");
          return;
        }

        if (!localRoles[targetUserRoom]) {
          localRoles[targetUserRoom] = {
            admins: new Set(),
            modos: new Set(),
            kicks: new Map(),
            bans: new Map(),
            mutes: new Set()
          };
        }

        switch (cmd) {
          case '/kick':
            localRoles[targetUserRoom].kicks.set(targetName, now + 90 * 60 * 1000);
            io.to(targetUser.id).emit('redirect', '/');
            setTimeout(() => io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom), 500);
            io.to(targetUserRoom).emit('server message', `${targetName} a été kické de ${targetUserRoom} par ${user.username}`);
            return;

          case '/ban':
            localRoles[targetUserRoom].bans.set(targetName, now + 3 * 60 * 60 * 1000);
            io.to(targetUser.id).emit('redirect', '/');
            setTimeout(() => io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom), 500);
            io.to(targetUserRoom).emit('server message', `${targetName} a été banni de ${targetUserRoom} par ${user.username}`);
            return;

          case '/mute':
            localRoles[targetUserRoom].mutes.add(targetName);
            io.to(targetUserRoom).emit('server message', `${targetName} a été muté dans ${targetUserRoom}`);
            return;

          case '/unmute':
            localRoles[targetUserRoom].mutes.delete(targetName);
            io.to(targetUserRoom).emit('server message', `${targetName} n'est plus muté dans ${targetUserRoom}`);
            return;

          case '/addmodo':
            if (!(user.role === 'admin' || isLocalAdmin(socket))) {
              socket.emit('error message', "Seul l'admin local ou un admin global peut ajouter un modo.");
              return;
            }
            localRoles[targetUserRoom].modos.add(targetName);
            io.to(targetUserRoom).emit('server message', `${targetName} est maintenant modo local de ${targetUserRoom}`);
            return;

          case '/remove':
            io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom);
            io.to(targetUser.id).emit('removedFromRoom', targetUserRoom);
            io.to(targetUserRoom).emit('server message', `${targetName} a été retiré du salon ${targetUserRoom} par ${user.username}`);
            return;
        }
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

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
