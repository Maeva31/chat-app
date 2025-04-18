import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Données en mémoire
let users = {};            // Stockage des utilisateurs avec leurs infos
let userRoles = {};        // Stockage des rôles (admin, modo, user)
let messageHistory = {};   // Historique des messages par salon
let roomUsers = {};        // Utilisateurs présents par salon
let userChannels = {};     // Canal actuel de chaque utilisateur (socket.id)
let channels = ['Général', 'Musique', 'Gaming', 'Détente']; // Liste des salons

app.use(express.static('public'));

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, (match) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[match]));
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  // Envoyer l'historique des messages et la liste des salons existants
  socket.emit('chat history', messageHistory['Général'] || []);
  socket.emit('room list', Object.keys(messageHistory));

  // Rejoindre un salon existant ou créer un salon
  socket.on('createRoom', (newChannel) => {
    console.log(`Tentative de création du salon : ${newChannel}`);

    // Vérification du rôle de l'utilisateur avant de créer le salon
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user || userRoles[user.username] === 'user') {
      socket.emit('error', 'Permission refusée pour créer un salon');
      return;
    }

    // Vérification si le salon existe déjà
    if (!channels.includes(newChannel)) {
      channels.push(newChannel);  // Ajout du salon à la liste des salons
      messageHistory[newChannel] = []; // Créer un historique de messages vide pour le nouveau salon
      roomUsers[newChannel] = []; // Créer une liste vide d'utilisateurs pour le salon
      console.log(`✅ Salon créé : ${newChannel}`);
      
      // Diffuser la création du salon à tous les clients
      io.emit('room created', newChannel);

      // Joindre le salon nouvellement créé automatiquement
      socket.join(newChannel);
      userChannels[socket.id] = newChannel;
      
      // Ajouter l'utilisateur dans la liste des utilisateurs du salon
      roomUsers[newChannel].push({ id: socket.id, username: user.username, gender: user.gender, age: user.age, role: user.role });
      io.to(newChannel).emit('user list', roomUsers[newChannel]);
    } else {
      console.log(`Le salon ${newChannel} existe déjà.`);
      socket.emit('room exists', newChannel); // Si le salon existe déjà, on informe l'utilisateur
    }
  });

  // Écouter l'événement de changement de pseudo et d'information
  socket.on('set username', (data) => {
    const { username, gender, age } = data;
    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);

    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      const oldSocketId = users[username].id;
      io.to(oldSocketId).emit('kicked');
      io.sockets.sockets.get(oldSocketId)?.disconnect();
    }

    if (!userRoles[username]) {
      userRoles[username] = Object.keys(userRoles).length === 0 ? 'admin' : 'user';
    }

    const userData = { username, gender, age, id: socket.id, role: userRoles[username] };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', userData);
  });

  // Envoyer un message dans le salon
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
      message: escapeHTML(msg.message || ""),
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    console.log(`💬 ${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);

    if (!messageHistory[currentChannel]) messageHistory[currentChannel] = [];
    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) messageHistory[currentChannel].shift();

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Événement pour rejoindre un salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) roomUsers[channel] = [];

    roomUsers[channel].push({ id: socket.id, username: user.username, gender: user.gender, age: user.age, role: user.role });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);

    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Gérer la déconnexion d'un utilisateur
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
    } else {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
