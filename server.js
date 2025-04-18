import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = [];
let messageHistory = {}; // Historique des messages par salon
let userChannels = {}; // Liste des salons auxquels les utilisateurs appartiennent
let roomUsers = {}; // Liste des utilisateurs dans chaque salon

// Servir les fichiers statiques
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique des messages à la connexion
  socket.emit('chat history', messageHistory['Général'] || []);

  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    // Validation du nom d'utilisateur
    const usernameIsInvalid =
      !username ||
      username.length > 16 ||
      /\s/.test(username);

    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    const alreadyExists = users.some(
      (user) => user.username === username && user.id !== socket.id
    );

    if (alreadyExists) {
      socket.emit('username exists', username);
      return;
    }

    const existingUserIndex = users.findIndex(user => user.id === socket.id);
    if (existingUserIndex !== -1) {
      users[existingUserIndex] = { username, gender, age, id: socket.id };
    } else {
      users.push({ username, gender, age, id: socket.id });
    }

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.emit('user list', users);
  });

  socket.on('chat message', (msg) => {
    const sender = users.find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général'; // Salon spécifique à l'utilisateur
    const messageToSend = {
      username: sender ? sender.username : "Anonyme",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel, // Ajout du salon
    };

    console.log(`💬 ${messageToSend.username} dans #${messageToSend.channel}: ${messageToSend.message}`);

    // Ajout des messages dans l'historique du salon spécifique
    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }
    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift(); // Limiter à 10 messages par salon
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      // Retirer l'utilisateur des salons
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel].map(user => user.username)); // Mise à jour de la liste des utilisateurs du salon
      }
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }

    // Retirer l'utilisateur de la liste des utilisateurs
    users = users.filter(user => user.id !== socket.id);
    io.emit('user list', users);

    // Retirer l'utilisateur des salons
    delete userChannels[socket.id];
  });

  // Changer de salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';

    // Vérification de l'utilisateur
    const user = users.find(user => user.id === socket.id);
    if (!user) {
      socket.emit('error', 'Utilisateur non défini');
      return;
    }

    // Quitter l'ancien salon
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(user => user.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel].map(user => user.username)); // Mise à jour de la liste dans l'ancien salon
    }

    socket.leave(oldChannel); // quitte l'ancien salon
    socket.join(channel);     // rejoint le nouveau salon

    userChannels[socket.id] = channel;

    // Ajouter l'utilisateur au salon actuel avec son pseudo mis à jour
    if (!roomUsers[channel]) {
      roomUsers[channel] = [];
    }

    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age,
    });

    console.log(`👥 ${socket.id} a rejoint le salon : ${channel}`);

    // Notifier tous les utilisateurs du salon de l'entrée de l'utilisateur
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      channel
    });

    // Envoi de l'historique des messages et de la liste des utilisateurs dans le salon
    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel].map(user => user.username));
  });

  // Création d'un nouveau salon
  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      console.log(`✅ Nouveau salon créé : ${newChannel}`);
      io.emit('room created', newChannel); // Notifie tous les clients que le salon a été créé
    } else {
      socket.emit('room exists', newChannel); // Si le salon existe déjà
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
