import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import multer from 'multer';



const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 70 * 1024 * 1024 // 70 Mo pour marge
});




const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

let users = {};           // { username: { id, username, gender, age, role, banned, muted, invisible } }
let messageHistory = {};
let roomUsers = {};
// Ajoute un utilisateur dans un salon en évitant les doublons et en gérant l'invisibilité
function addUserToRoom(channel, user) {
  if (!roomUsers[channel]) roomUsers[channel] = [];
  // Supprime les doublons
  roomUsers[channel] = roomUsers[channel].filter(u => u.id !== user.id);
  // N'ajoute l'utilisateur que s'il n'est pas invisible
  if (!user.invisible) {
    roomUsers[channel].push(user);
  }
}

// Retire un utilisateur d'un salon
function removeUserFromRoom(channel, socketId) {
  if (!roomUsers[channel]) return;
  roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socketId);
}
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
  const visibleUsers = roomUsers[channel].filter(u => !u.invisible);
  console.log(`Envoi liste users salon ${channel} :`, visibleUsers.map(u => u.username));
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
  limits: { fileSize: 50 * 1024 * 1024 }, // ✅ 50 Mo max
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

    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

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

  socket.on('upload private file', ({ to, filename, mimetype, data, timestamp }) => {
    const sender = Object.values(users).find(u => u.id === socket.id);
    if (!sender) return;

    const recipient = users[to];
    if (!recipient) {
      socket.emit('error message', `Utilisateur ${to} introuvable pour envoi de fichier privé.`);
      return;
    }

    if (bannedUsers.has(sender.username)) {
      socket.emit('error message', 'Vous êtes banni et ne pouvez pas envoyer de fichiers privés.');
      return;
    }

    if (mutedUsers.has(sender.username)) {
      socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de fichiers privés.');
      return;
    }

    const fileMsg = {
      from: sender.username,
      to,
      filename,
      mimetype,
      data,
      timestamp: timestamp || new Date().toISOString(),
      role: sender.role,
      gender: sender.gender,
    };

    io.to(recipient.id).emit('private file', fileMsg);
    socket.emit('private file', fileMsg);
  });

  function logout(socket) {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) {
      console.log(`Logout : utilisateur non trouvé pour socket ${socket.id}`);
      return;
    }

    tempMods.admins.delete(user.username);
    tempMods.modos.delete(user.username);

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

  // --- Gestion WebRTC (signaling) ---
  socket.on('signal', ({ to, from, data }) => {
    if (users[to]) {
      io.to(users[to].id).emit('signal', { from, data });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Déconnexion : ${socket.id}`);
    const user = Object.values(users).find(u => u.id === socket.id);
    if (user) {
      delete users[user.username];
      socket.broadcast.emit('user-left', user.username);
    }
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
      if (passwords[username] !== password) {
        return socket.emit('password error', 'Mot de passe incorrect pour ce compte privilégié.');
      }
      console.log(`🔐 Authentification réussie pour ${username}`);
    }

    const invisibleFromClient = invisible === true;
    const prevInvisible = users[username]?.invisible ?? invisibleFromClient;

    const role = getUserRole(username);
    const userData = { username, gender, age, id: socket.id, role, banned: false, muted: false, invisible: prevInvisible };
    users[username] = userData;

    let channel = userChannels[socket.id] || defaultChannel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    removeUserFromRoom(channel, socket.id);
    addUserToRoom(channel, userData);


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

  // Gestion du message normal ou commande
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

  // Gestion des commandes réservées admin/modo (omise ici pour clarté, tu peux garder ta logique)

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

// Rejoindre un salon
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
    removeUserFromRoom(oldChannel, socket.id);
    emitUserList(oldChannel);

    userChannels[socket.id] = newChannel;
    socket.join(newChannel);

    removeUserFromRoom(newChannel, socket.id);
    addUserToRoom(newChannel, user);

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
      addUserToRoom(newChannel, user);
    }
  }

  socket.emit('chat history', messageHistory[newChannel]);
  emitUserList(newChannel);
  socket.emit('joinedRoom', newChannel);
  updateRoomUserCounts();
  cleanupEmptyDynamicRooms();
});

// Créer un salon
socket.on('createRoom', (newChannel) => {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  if (mutedUsers.has(user.username)) {
    socket.emit('error', 'Vous êtes muté et ne pouvez pas créer de salons.');
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
    removeUserFromRoom(oldChannel, socket.id);
    emitUserList(oldChannel);

    io.to(oldChannel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a quitté le salon ${oldChannel}`,
      timestamp: new Date().toISOString(),
      channel: oldChannel
    });
  }

  userChannels[socket.id] = newChannel;
  socket.join(newChannel);
  addUserToRoom(newChannel, user);

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

// Gestion de la déconnexion
socket.on('disconnect', () => {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (user) {
    console.log(`❌ Déconnexion : ${user.username}`);

    tempMods.admins.delete(user.username);
    tempMods.modos.delete(user.username);

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

    // Supprime l'utilisateur de tous les salons
    for (const channel in roomUsers) {
      removeUserFromRoom(channel, socket.id);
    }

    delete users[user.username];
    delete userChannels[socket.id];

    cleanupEmptyDynamicRooms();
  } else {
    console.log(`❌ Déconnexion inconnue : ${socket.id}`);
  }
});

  
    socket.on('private message', ({ to, message, style, timestamp }) => {
    const sender = Object.values(users).find(u => u.id === socket.id);
    const recipient = users[to];

    if (!sender) return;
    if (!recipient) {
      socket.emit('error message', `Utilisateur ${to} introuvable pour message privé.`);
      return;
    }

    if (bannedUsers.has(sender.username)) {
      socket.emit('error message', 'Vous êtes banni et ne pouvez pas envoyer de messages privés.');
      return;
    }

    if (mutedUsers.has(sender.username)) {
      socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages privés.');
      return;
    }

    const privateMsg = {
      from: sender.username,
      to,
      gender: sender.gender,
      role: sender.role,
      message,
      style: style || {},
      timestamp: timestamp || new Date().toISOString(),
      private: true
    };

    // Envoyer au destinataire
    io.to(recipient.id).emit('private message', privateMsg);
    // Écho au sender
    socket.emit('private message', privateMsg);
  });



});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
