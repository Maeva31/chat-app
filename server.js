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
let userChannels = {};
let bannedUsers = new Set();   // pseudos bannis (simple set, pour persister on peut ajouter fichier json)
let mutedUsers = new Set();    // pseudos mutés
let roomOwners = {};        // { roomName: username }
let roomModerators = {};    // { roomName: Set(username) }
let roomBans = {};          // { roomName: Set(username) }


const usernameToSocketId = {};
const socketIdToUsername = {};


// Anti-spam
const spamTracker = {}; // { socket.id: [timestamps] }
const SPAM_LIMIT = 5; // nombre max de messages autorisés
const SPAM_WINDOW_MS = 5000; // période de contrôle (en ms) → 5 secondes


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

const defaultRooms = ['Général', 'Musique', 'Gaming', 'Célibataire', 'Détente', 'Insultes'];
const protectedRooms = ['Lesbiennes', 'GayGay', 'TransGirl', 'Paris', 'Reims', 'Lyon', 'Marseille', 'Nice', 'Toulouse', 'Sexe', 'Amateur'];


let roomList = [];
try {
  const data = fs.readFileSync('rooms.json', 'utf-8');
  roomList = JSON.parse(data); // ← on lit l'ordre original
} catch (err) {
  console.warn('⚠️ rooms.json introuvable, fallback.');
  roomList = ['Général'];
}

// ✅ Fusion sans doublons, on garde l’ordre de rooms.json
let savedRooms = [...defaultRooms];
roomList.forEach(room => {
  if (!savedRooms.includes(room)) savedRooms.push(room);
});

// ✅ Préparation des structures pour chaque vrai salon
savedRooms.forEach(room => {
  if (room.startsWith('__') && room.endsWith('__')) return; // ← on ignore les séparateurs
  if (!messageHistory[room]) messageHistory[room] = [];
  if (!roomUsers[room]) roomUsers[room] = [];
});



// Préparation des structures internes
savedRooms.forEach(room => {
  if (!messageHistory[room]) messageHistory[room] = [];
  if (!roomUsers[room]) roomUsers[room] = [];
});

// ✅ Dans ta connexion socket :
io.on('connection', (socket) => {
  // ... tes autres blocs socket ...

  // Envoie les salons complets au client
  socket.emit('room list', savedRooms);
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

  const usersInRoom = roomUsers[channel]
    .filter(u => !u.invisible)
    .map(u => ({
      username: u.username,
      age: u.age,
      gender: u.gender,
      role: u.role,
      isRoomOwner: roomOwners[channel] === u.username,
      isRoomModo: roomModerators[channel]?.has(u.username)
    }));

  io.to(channel).emit('user list', usersInRoom);
}



function cleanupEmptyDynamicRooms() {
  for (const room of savedRooms) {
    if (
      defaultRooms.includes(room) ||                       // salons de base
      protectedRooms.includes(room) ||                     // salons protégés manuellement
      (room.startsWith('__') && room.endsWith('__'))       // titres comme __LGBT__
    ) continue;

    if (roomUsers[room] && roomUsers[room].length === 0) {
      delete messageHistory[room];
      delete roomUsers[room];
      savedRooms = savedRooms.filter(r => r !== room);
      fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
      console.log(`❌ Salon supprimé (vide) : ${room}`);
      io.emit('room list', savedRooms);
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

const messageObject = {
  username: username,
  message: message,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

messageHistory[room].push(messageObject);
if (messageHistory[room].length > MAX_HISTORY) messageHistory[room].shift();

io.to(room).emit('chat message', messageObject); // ✅ on envoie un vrai objet !

res.json({ success: true, url: fileUrl });
  }
});




io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

socket.on('private wiizz', ({ to }) => {
  const targetSocketId = usernameToSocketId[to];
  const fromUsername = socketIdToUsername[socket.id];

  if (targetSocketId && fromUsername && fromUsername !== to) {
    io.to(targetSocketId).emit('private wiizz', { from: fromUsername });
  }
});

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

    // Envoi au destinataire
    io.to(recipient.id).emit('private file', fileMsg);
    // Écho au sender (pour affichage local)
    socket.emit('private file', fileMsg);
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

  const username = socketIdToUsername[socket.id];

  socket.emit('chat history', messageHistory[defaultChannel]);
  emitUserList(defaultChannel);
  const userBannedRooms = Object.entries(roomBans)
  .filter(([room, bans]) => bans.has(username))
  .map(([room]) => room);

  socket.emit('banned rooms list', userBannedRooms);

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

    usernameToSocketId[username] = socket.id;
    socketIdToUsername[socket.id] = username;

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

  const room = userChannels[socket.id];
  const channel = userChannels[socket.id] || defaultChannel;

    // Anti-spam
  const now = Date.now();
  spamTracker[socket.id] = spamTracker[socket.id] || [];
  spamTracker[socket.id] = spamTracker[socket.id].filter(ts => now - ts < SPAM_WINDOW_MS);
  spamTracker[socket.id].push(now);

  if (spamTracker[socket.id].length > SPAM_LIMIT) {
    socket.emit('error message', '⛔ Tu écris trop vite, attends un peu !');
    return;
  }


  // Vérifie si l'utilisateur est banni du salon actuel
  if (roomBans[channel]?.has(user.username)) {
    socket.emit('error message', `Tu es banni du salon ${channel}.`);
    return;
  }

  if (bannedUsers.has(user.username)) {
    socket.emit('error message', 'Vous êtes banni du serveur.');
    socket.emit('redirect', 'https://banned.maevakonnect.fr');
    return;
  }

  if (mutedUsers.has(user.username)) {
    socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages.');
    return;
  }

  const messageText = typeof msg === 'string' ? msg : (typeof msg.message === 'string' ? msg.message : null);
  if (!messageText) return;

  // Si commande
  if (messageText.startsWith('/')) {
    const args = messageText.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    const targetName = args[1];
    const targetUser = users[targetName];

    const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');
    const isUserModo = user.role === 'modo';
    const isUserAdmin = user.role === 'admin';

    
    if (!roomModerators[room]) roomModerators[room] = new Set();
    if (!roomBans[room]) roomBans[room] = new Set();

    const isRoomOwner = roomOwners[room] === user.username;
    const isRoomModo = roomModerators[room].has(user.username);
    const isPrivilegedAdmin = isUserAdmin && passwords[user.username];

switch (cmd) {
  case '/ban':
  case '/kick':
  case '/mute':
  case '/unmute':
    if (!isUserAdmin && !isUserModo) {
      socket.emit('error message', 'Seuls les modérateurs ou administrateurs peuvent utiliser cette commande.');
      return;
    }

    if (
      !targetUser ||
      targetName === user.username ||
      (isUserModo && isTargetProtected) ||
      (isUserAdmin && isTargetProtected && !isPrivilegedAdmin)
    ) {
      socket.emit('error message', 'Action non autorisée ou utilisateur invalide.');
      return;
    }

    // ✅ Empêche les roommodos d'utiliser les commandes globales
    if (isRoomModo && !isUserModo && !isUserAdmin) {
      socket.emit('error message', "Tu es modérateur local, tu ne peux pas utiliser cette commande globale.");
      return;
    }
    break;
}





switch (cmd) {
  case '/ban':
    bannedUsers.add(targetName);
    io.to(targetUser.id).emit('banned');
    io.to(targetUser.id).emit('redirect', 'https://banned.maevakonnect.fr');
    setTimeout(() => io.sockets.sockets.get(targetUser.id)?.disconnect(), 1500);
    io.to(channel).emit('server message', `${targetName} a été banni par ${user.username}.`);
    console.log(`⚠️ ${user.username} a banni ${targetName}`);
    break;

  case '/kick':
    io.to(targetUser.id).emit('kicked');
    io.to(targetUser.id).emit('redirect', 'https://maevakonnect.fr');
    setTimeout(() => io.sockets.sockets.get(targetUser.id)?.disconnect(), 1500);
    io.to(channel).emit('server message', `${targetName} a été expulsé par ${user.username}.`);
    console.log(`⚠️ ${user.username} a expulsé ${targetName}`);
    break;

  case '/mute':
    mutedUsers.add(targetName);
    io.to(targetUser.id).emit('muted');
    io.to(channel).emit('server message', `${targetName} a été muté par ${user.username}.`);
    console.log(`⚠️ ${user.username} a muté ${targetName}`);
    break;

  case '/unmute':
    if (mutedUsers.has(targetName)) {
      mutedUsers.delete(targetName);
      io.to(targetUser.id).emit('unmuted');
      io.to(channel).emit('server message', `${targetName} a été unmuté par ${user.username}.`);
      console.log(`⚠️ ${user.username} a unmuté ${targetName}`);
    } else {
      socket.emit('error message', `${targetName} n'est pas muté.`);
    }
    break;

  case '/unban':
    if (bannedUsers.has(targetName)) {
      bannedUsers.delete(targetName);
    } else {
      socket.emit('error message', `${targetName} n'est pas banni.`);
    }
    break;

case '/kickroom': {
  const room = userChannels[socket.id];

  if (!isRoomOwner && (!roomModerators[room] || !roomModerators[room].has(user.username))) {
    return socket.emit('error message', "Tu n'es pas modérateur de ce salon.");
  }

  if (!targetUser) {
    return socket.emit('error message', "Utilisateur introuvable.");
  }

  const isProtected = ['admin', 'modo'].includes(targetUser.role) && passwords[targetName];
  if (isProtected) {
    return socket.emit('error message', "Impossible d’expulser un modérateur ou admin authentifié.");
  }

  if (roomOwners[room] === targetName) {
    return socket.emit('error message', "Impossible d'expulser le créateur du salon.");
  }

  const targetSocket = io.sockets.sockets.get(usernameToSocketId[targetName]);
  if (targetSocket && userChannels[targetSocket.id] === room) {
    targetSocket.leave(room);
    userChannels[targetSocket.id] = defaultChannel;
    targetSocket.join(defaultChannel);

    if (roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter(u => u.id !== targetSocket.id);
    }

    emitUserList(room);
    updateRoomUserCounts();

    io.to(room).emit('server message', `${targetName} a été expulsé du salon par ${user.username}.`);
    messageHistory[room].push({
      username: 'Système',
      message: `${targetName} a été expulsé du salon par ${user.username}.`,
      timestamp: new Date().toISOString(),
      channel: room
    });
    if (messageHistory[room].length > MAX_HISTORY) messageHistory[room].shift();

    io.to(targetSocket.id).emit('server message', `Tu as été déplacé dans #${defaultChannel} après expulsion.`);
    targetSocket.emit('error message', `Tu as été expulsé du salon ${room}.`);
    targetSocket.emit('redirect to room', defaultChannel);
  }
  break;
}



case '/banroom': {
  const room = userChannels[socket.id];

  if (!isRoomOwner && (!roomModerators[room] || !roomModerators[room].has(user.username))) {
    return socket.emit('error message', "Tu n'es pas modérateur de ce salon.");
  }

  if (!targetUser) {
    return socket.emit('error message', "Utilisateur introuvable.");
  }

  const isProtected = ['admin', 'modo'].includes(targetUser.role) && passwords[targetName];
  if (isProtected) {
    return socket.emit('error message', "Impossible de bannir un modérateur ou admin authentifié.");
  }

  if (roomOwners[room] === targetName) {
    return socket.emit('error message', "Impossible de bannir le créateur du salon.");
  }

  roomBans[room].add(targetName);

  const targetSocket = io.sockets.sockets.get(usernameToSocketId[targetName]);
  if (targetSocket && userChannels[targetSocket.id] === room) {
    targetSocket.leave(room);
    userChannels[targetSocket.id] = defaultChannel;
    targetSocket.join(defaultChannel);

    if (roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter(u => u.id !== targetSocket.id);
    }

    emitUserList(room);
    updateRoomUserCounts();

    io.to(room).emit('server message', `${targetName} a été banni du salon par ${user.username}.`);
    messageHistory[room].push({
      username: 'Système',
      message: `${targetName} a été banni du salon par ${user.username}.`,
      timestamp: new Date().toISOString(),
      channel: room
    });
    if (messageHistory[room].length > MAX_HISTORY) messageHistory[room].shift();

    io.to(targetSocket.id).emit('server message', `Tu as été déplacé dans #${defaultChannel} après bannissement.`);
    targetSocket.emit('error message', `Tu as été banni du salon ${room}.`);
    targetSocket.emit('redirect to room', defaultChannel);
  }
  break;
}





case '/unbanroom': {
  const room = userChannels[socket.id];

  if (!isRoomOwner && (!roomModerators[room] || !roomModerators[room].has(user.username))) {
    return socket.emit('error message', "Tu n'es pas modérateur de ce salon.");
  }

  if (roomBans[room]?.has(targetName)) {
    roomBans[room].delete(targetName);

    socket.emit('server message', `${targetName} a été débanni du salon ${room}.`);
    socket.emit('error message', `${targetName} a bien été débanni du salon ${room}.`);

    // 🔔 Prévenir l'utilisateur ciblé s'il est en ligne
    const targetSocketId = usernameToSocketId[targetName];
    if (targetSocketId && io.sockets.sockets.get(targetSocketId)) {
      io.to(targetSocketId).emit('server message', `Tu as été débanni du salon ${room}.`);
    }

  } else {
    socket.emit('error message', `${targetName} n'est pas banni de ce salon.`);
  }
  break;
}




case '/addroommodo': {
  const room = userChannels[socket.id];

  if (!isRoomOwner) {
    return socket.emit('error message', "Seul le créateur du salon peut ajouter un modérateur local.");
  }

  if (!targetUser || userChannels[targetUser.id] !== room) {
    return socket.emit('error message', `${targetName} doit être présent dans le salon.`);
  }

  if (roomOwners[room] === targetName) {
    return socket.emit('error message', "Le créateur du salon est déjà au-dessus des modérateurs.");
  }

  const targetRole = users[targetName]?.role || 'user';
  if (targetRole === 'admin' || targetRole === 'modo') {
    return socket.emit('error message', `${targetName} est déjà ${targetRole} global et ne peut pas être modérateur local.`);
  }

  roomModerators[room].add(targetName);
  io.to(room).emit('server message', `${targetName} est maintenant modérateur du salon ${room}.`);
  emitUserList(room);
  break;
}



case '/removeroommodo': {
  const room = userChannels[socket.id];

  if (!isRoomOwner) {
    return socket.emit('error message', "Seul le créateur du salon peut retirer un modérateur local.");
  }

  if (roomOwners[room] === targetName) {
    return socket.emit('error message', "Impossible de retirer les droits du créateur du salon.");
  }

  if (roomModerators[room].has(targetName)) {
    roomModerators[room].delete(targetName);
    io.to(room).emit('server message', `${targetName} n'est plus modérateur du salon ${room}.`);
    emitUserList(room);
  } else {
    socket.emit('error message', `${targetName} n'est pas modérateur du salon ${room}.`);
  }
  break;
}





  case '/addmodo':
  case '/addadmin': {
    const isTrueAdmin = modData.admins.includes(user.username);
    if (!isTrueAdmin) return socket.emit('error message', 'Seuls les vrais admins peuvent ajouter un rôle.');
    if (!targetUser) return socket.emit('error message', `Utilisateur ${targetName || '?'} introuvable.`);

    const isAdmin = cmd === '/addadmin';
    const setName = isAdmin ? tempMods.admins : tempMods.modos;
    const removeName = isAdmin ? tempMods.modos : tempMods.admins;

    if (!setName.has(targetName)) {
      setName.add(targetName);
      removeName.delete(targetName);

      users[targetName].role = isAdmin ? 'admin' : 'modo';
      io.to(channel).emit('role update', { username: targetName, newRole: users[targetName].role });
      fs.writeFileSync('moderators.json', JSON.stringify(modData, null, 2));

      const roleLabel = isAdmin ? 'administrateur' : 'modérateur';
      io.to(channel).emit('server message', `${targetName} est maintenant ${roleLabel} temporaire (ajouté par ${user.username}).`);
      console.log(`⚠️ ${user.username} a promu ${targetName} comme ${roleLabel} temporaire.`);
    } else {
      socket.emit('error message', `${targetName} est déjà ${isAdmin ? 'admin' : 'modo'}.`);
    }
    break;
  }

  case '/removemodo':
  case '/removeadmin': {
    if (!isPrivilegedAdmin)
      return socket.emit('error message', "Seul un admin authentifié peut retirer un rôle.");

    if (!targetUser)
      return socket.emit('error message', `Utilisateur ${targetName || '?'} introuvable.`);

    if (targetName === user.username)
      return socket.emit('error message', 'Impossible de retirer votre propre rôle.');

    const wasAdmin = tempMods.admins.has(targetName) || modData.admins.includes(targetName);
    const wasModo = tempMods.modos.has(targetName) || modData.modos.includes(targetName);

    tempMods.admins.delete(targetName);
    tempMods.modos.delete(targetName);

    modData.admins = modData.admins.filter(u => u !== targetName);
    modData.modos = modData.modos.filter(u => u !== targetName);
    fs.writeFileSync('moderators.json', JSON.stringify(modData, null, 2));

    if (users[targetName]) {
      users[targetName].role = 'user';
      io.to(channel).emit('role update', { username: targetName, newRole: 'user' });

      if (wasModo) {
        io.to(channel).emit('server message', `${user.username} a retiré le rôle modérateur de ${targetName}.`);
        console.log(`⚠️ ${user.username} a retiré le rôle modo à ${targetName}.`);
      }

      if (wasAdmin) {
        io.to(channel).emit('server message', `${user.username} a retiré le rôle administrateur de ${targetName}.`);
        console.log(`⚠️ ${user.username} a retiré le rôle admin à ${targetName}.`);
      }

      if (users[targetName].invisible) {
        users[targetName].invisible = false;
        const targetSocketId = users[targetName].id;
        const targetChannel = userChannels[targetSocketId];

        if (roomUsers[targetChannel]) {
          const u = roomUsers[targetChannel].find(u => u.id === targetSocketId);
          if (u) u.invisible = false;
        }

        io.to(targetSocketId).emit('server message', "Vous avez perdu votre rôle, le mode invisible est désactivé.");
        emitUserList(targetChannel);
        updateRoomUserCounts();
      }
    }
    break;
  }






      case '/invisible':
        if (!isUserAdmin) return socket.emit('error message', 'Commande réservée aux admins.');
        if (!args[1]) return socket.emit('error message', 'Usage : /invisible on|off');
        const mode = args[1].toLowerCase();
        user.invisible = mode === 'on';
        const room = userChannels[socket.id];
        const u = roomUsers[room]?.find(u => u.id === socket.id);
        if (u) u.invisible = mode === 'on';
        emitUserList(room);
        updateRoomUserCounts();
        break;

      default:
        socket.emit('error message', 'Commande inconnue.');
        return;
    }

    return;
  }

  // Message normal
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


socket.on('join room', room => {
  const username = socketIdToUsername[socket.id];
  if (!username) return;

  if (roomBans[room]?.has(username)) {
    return socket.emit('error message', `Tu as été banni du salon ${room}.`);
  }

  // Quitter l'ancien salon
  const previousRoom = userChannels[socket.id];
  if (previousRoom && previousRoom !== room) {
    socket.leave(previousRoom);
    if (roomUsers[previousRoom]) {
      roomUsers[previousRoom] = roomUsers[previousRoom].filter(u => u.id !== socket.id);
      emitUserList(previousRoom);
    }
  }

  socket.join(room);
  userChannels[socket.id] = room;

  if (!roomUsers[room]) roomUsers[room] = [];
  roomUsers[room].push({ id: socket.id, username });
  emitUserList(room);

  socket.emit('chat history', messageHistory[room] || []);

  // ✅ Envoi des infos du salon (créateur + modérateurs)
  socket.emit('room info', {
    room,
    owner: roomOwners[room],
    moderators: Array.from(roomModerators[room] || [])
  });
});







socket.on('joinRoom', (newChannel) => {
  if (typeof newChannel !== 'string' || !newChannel.trim()) {
    return socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
  }

  const oldChannel = userChannels[socket.id] || defaultChannel;
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  // 💥 Blocage par genre
const isPrivileged = user.isPrivilegedAdmin || user.role === 'admin' || user.role === 'modo';

// 🔒 Blocage Homme dans Lesbiennes (sauf staff)
if (newChannel === 'Lesbiennes' && user.gender === 'Homme' && !isPrivileged) {
  return socket.emit('error message', "Tu n'es pas autorisé à entrer dans ce salon.");
}

// 🔒 Blocage Femme dans GayGay (sauf staff)
if (newChannel === 'GayGay' && user.gender === 'Femme' && !isPrivileged) {
  return socket.emit('error message', "Tu n'es pas autorisée à entrer dans ce salon.");
}

// 🔒 Blocage Trans dans GayGay (sauf staff)
if (newChannel === 'GayGay' && user.gender === 'Trans' && !isPrivileged) {
  return socket.emit('error message', "Tu n'es pas autorisé à entrer dans ce salon.");
}



  // 🔒 Vérification du ban local AVANT de joindre le salon
  if (roomBans[newChannel]?.has(user.username)) {
    return socket.emit('error message', `Tu es banni du salon ${newChannel} et ne peux pas y accéder.`);
  }

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
    return;
  }

  if (typeof newChannel !== 'string' || !newChannel.trim() || newChannel.length > 20 || /\s/.test(newChannel)) {
    return socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
  }

  // 🔒 Protection création de salon selon genre
  const isPrivileged = user.isPrivilegedAdmin || user.role === 'admin' || user.role === 'modo';

  if (newChannel === 'Lesbiennes' && user.gender === 'Homme' && !isPrivileged) {
    return socket.emit('error message', "Tu ne peux pas créer ce salon.");
  }

  if (newChannel === 'GayGay') {
    if (user.gender === 'Femme' && !isPrivileged) {
      return socket.emit('error message', "Tu ne peux pas créer ce salon.");
    }
    if (user.gender === 'Trans' && !isPrivileged) {
      return socket.emit('error message', "Tu ne peux pas créer ce salon.");
    }
  }

  if (savedRooms.includes(newChannel)) {
    return socket.emit('room exists', newChannel);
  }

  if (savedRooms.length >= MAX_ROOMS) {
    return socket.emit('error', 'Nombre maximum de salons atteint.');
  }

  roomOwners[newChannel] = user.username;
  roomModerators[newChannel] = new Set([user.username]);
  roomBans[newChannel] = new Set();

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

    // Supprimer mappings username↔socketId
    delete usernameToSocketId[user.username];
    delete socketIdToUsername[socket.id];

    // SUPPRESSION des rôles temporaires à la déconnexion
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

    for (const channel in roomUsers) {
      roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
      emitUserList(channel);
    }

    delete users[user.username];
    delete userChannels[socket.id];
    delete spamTracker[socket.id];


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
