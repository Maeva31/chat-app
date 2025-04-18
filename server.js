import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = {};            // Stockage des utilisateurs avec leurs informations
let messageHistory = {};   // Historique des messages par salon
let roomUsers = {};        // Utilisateurs par salon
let userChannels = {};     // Salon actuel par utilisateur

// Fichiers statiques
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique par défaut (salon Général)
  socket.emit('chat history', messageHistory['Général'] || []);

  // Lorsqu'un utilisateur définit son nom
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

    // Ajouter l'utilisateur au salon actuel
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré ou mis à jour : ${username} (${gender}, ${age} ans)`);

    // Mise à jour de la liste des utilisateurs dans le salon
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);

    // Notifier le changement
    socket.emit('username accepted', username);
  });

  // Lors de l'envoi d'un message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",  // Affiche 'Inconnu' si l'utilisateur est mal récupéré
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    // Affichage du message pour débogage
    if (!sender) {
      console.warn('Message envoyé sans utilisateur défini, message ignoré ou problème avec l\'utilisateur');
    }

    console.log(`💬 ${messageToSend.username} dans #${messageToSend.channel}: ${messageToSend.message}`);

    // Gérer l'historique des messages par salon
    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Lorsqu'un utilisateur se déconnecte
  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      // Retirer l'utilisateur de tous les salons
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]); // Mise à jour correcte
      }

      // Nettoyer les utilisateurs
      delete users[disconnectedUser.username];
      io.emit('user list', Object.values(users).map(u => u.username));
      delete userChannels[socket.id];
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }
  });

  // Lorsqu'un utilisateur rejoint un salon
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
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);  // Mise à jour correcte
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) {
      roomUsers[channel] = [];
    }

    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age
    });

    console.log(`👥 ${socket.id} a rejoint le salon : ${channel}`);

    // Envoyer un message de bienvenue
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    // Envoyer l'historique des messages du salon
    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);  // Mise à jour correcte
  });

  // Création d'un nouveau salon
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
