import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = {};            // Utilisation d'un objet pour les utilisateurs
let messageHistory = {};   // Historique des messages par salon
let roomUsers = {};        // Utilisateurs par salon
let userChannels = {};     // Salon actuel par utilisateur

// Fichiers statiques
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique par défaut (salon Général)
  socket.emit('chat history', messageHistory['Général'] || []);

  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    // Validation du nom d'utilisateur et des informations
    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);
    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    // Vérifier si le nom d'utilisateur existe déjà
    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    // Ajout ou mise à jour de l'utilisateur
    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    // Associer l'utilisateur au salon (Général par défaut)
    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) {
      roomUsers[currentChannel] = [];
    }

    // Supprimer l'utilisateur précédent dans le salon
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré ou mis à jour : ${username} (${gender}, ${age} ans)`);

    // Mise à jour de la liste des utilisateurs dans le salon
    io.to(currentChannel).emit('user list', roomUsers[currentChannel].map(u => u.username));

    // Notifier le changement
    socket.emit('username accepted', username);
  });

  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    // Si aucun utilisateur n'est trouvé pour ce socket, utiliser "Anonyme"
    const username = sender ? sender.username : "Anonyme";
    const gender = sender ? sender.gender : "Non précisé";

    const messageToSend = {
      username,
      gender,
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    console.log(`💬 ${messageToSend.username} dans #${messageToSend.channel}: ${messageToSend.message}`);

    // Gérer l'historique des messages par salon
    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    // Limiter l'historique à 10 messages
    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      // Retirer l'utilisateur de tous les salons
      for (const channel in roomUsers) {
        if (roomUsers[channel]) {
          roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
          io.to(channel).emit('user list', roomUsers[channel].map(user => user.username));
        }
      }

      // Nettoyer les utilisateurs
      delete users[disconnectedUser.username];
      io.emit('user list', Object.values(users).map(u => u.username));
      delete userChannels[socket.id];
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }
  });

  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';
    const user = Object.values(users).find(user => user.id === socket.id);

    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    // Quitter ancien salon
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel].map(u => u.username));
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) {
      roomUsers[channel] = [];
    }

    // Ajouter l'utilisateur au nouveau salon
    if (!roomUsers[channel].find(u => u.id === socket.id)) {
      roomUsers[channel].push({
        id: socket.id,
        username: user.username,
        gender: user.gender,
        age: user.age
      });
    }

    console.log(`👥 ${socket.id} a rejoint le salon : ${channel}`);

    // Envoyer un message de bienvenue
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    // Envoyer l'historique des messages du salon
    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel].map(u => u.username));
  });

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Nouveau salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
    } else {
      socket.emit('room exists', newChannel);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
