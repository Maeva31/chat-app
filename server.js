import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Données en mémoire
let users = {}; // username => { username, gender, age, id, role }
let bannedUsers = {}; // username => true
let mutedUsers = {}; // socket.id => true
let messageHistory = {}; // channel => messages[]
let roomUsers = {}; // channel => [{username, gender, age, id}]
let userChannels = {}; // socket.id => channel

// Définition des rôles par défaut (peut être étendu ou stocké autrement)
const defaultRole = 'user';
const elevatedUsers = {
  'AdminUser': 'admin',
  'ModoUser': 'modo'
};

// Vérification du pseudo [USER] et autres contraintes
function isValidUsername(username) {
  if (username === '[USER]' || username.length > 16 || /\s/.test(username)) {
    return false;
  }
  return true;
}

// Connexion de Socket.io
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);
  socket.emit('chat history', messageHistory['Général'] || []);

  // Authentification et enregistrement
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    if (!isValidUsername(username)) {
      socket.emit('username exists', username);
      return;
    }

    if (!age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (bannedUsers[username]) {
      socket.emit('banned');
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const role = elevatedUsers[username] || defaultRole;

    const userData = { username, gender, age, id: socket.id, role };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur connecté : ${username} (${role})`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
  });

  // Envoi d’un message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    if (!sender || mutedUsers[socket.id]) {
      return; // Ne pas envoyer si l'utilisateur est muet
    }

    const messageToSend = {
      username: sender.username,
      gender: sender.gender,
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

  // Déconnexion
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
      delete mutedUsers[socket.id];
    } else {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
    }
  });

  // Changement de salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    socket.leave(oldChannel);
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
    }

    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel].push({ id: socket.id, username: user.username, gender: user.gender, age: user.age });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Création de salon
  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Commandes de modération
  socket.on('moderation', (action) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    if (!sender || (sender.role !== 'admin' && sender.role !== 'modo')) {
      socket.emit('error', 'Permission refusée');
      return;
    }

    const { command, targetUsername } = action;
    const target = users[targetUsername];

    if (!target) {
      socket.emit('error', 'Utilisateur non trouvé');
      return;
    }

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
      default:
        socket.emit('error', 'Commande invalide');
        break;
    }

    console.log(`🛡️ ${sender.username} a utilisé ${command} sur ${target.username}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
