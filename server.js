import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = [];
let messageHistory = []; // Historique des messages
let currentChannel = 'Général'; // Salon par défaut

// Servir les fichiers statiques
app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoi de l'historique des messages à la connexion
  socket.emit('chat history', messageHistory);

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
    const messageToSend = {
      username: msg.username || "Anonyme",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel, // Ajout du salon
    };

    console.log(`💬 ${messageToSend.username} dans #${messageToSend.channel}: ${messageToSend.message}`);

    messageHistory.push(messageToSend);
    if (messageHistory.length > 10) {
      messageHistory.shift();
    }

    io.emit('chat message', messageToSend);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }

    // Retirer l'utilisateur de la liste des utilisateurs
    users = users.filter(user => user.id !== socket.id);
    io.emit('user list', users);
  });

  // Changer de salon
  socket.on('joinRoom', (channel) => {
    currentChannel = channel;
    console.log(`👥 ${socket.id} a rejoint le salon : ${currentChannel}`);
    io.emit('chat message', { username: 'Système', message: `${socket.id} a rejoint le salon ${currentChannel}`, channel });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
