import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config(); // Pour charger ADMIN_KEY depuis .env

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 🔐 Clé d'administration (à stocker dans .env ou définir ici)
const ADMIN_KEY = process.env.ADMIN_KEY || '123456';

let users = [];
let messageHistory = [];

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvel utilisateur connecté (socket ID: ${socket.id})`);

  // Envoyer l'historique
  socket.emit('chat history', messageHistory);

  // Enregistrement du pseudo et des infos
  socket.on('set username', (data) => {
    const { username, gender, age, adminKey } = data;

    const usernameIsInvalid = 
      !username || 
      username.length > 16 || 
      /\s/.test(username) ||
      !gender;

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

    const isAdmin = adminKey === ADMIN_KEY;

    const userData = { username, gender, age, id: socket.id, isAdmin };

    const existingUserIndex = users.findIndex(user => user.id === socket.id);
    if (existingUserIndex !== -1) {
      users[existingUserIndex] = userData;
    } else {
      users.push(userData);
    }

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans) ${isAdmin ? '[ADMIN]' : ''}`);

    io.emit('user list', users);
  });

  // Réception d'un message
  socket.on('chat message', (msg) => {
    const sender = users.find(user => user.id === socket.id);

    const messageToSend = {
      username: sender?.username || msg.username || "Anonyme",
      gender: sender?.gender || "Non précisé",
      age: sender?.age || null,
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString()
    };

    console.log(`💬 ${messageToSend.username}: ${messageToSend.message}`);

    messageHistory.push(messageToSend);
    if (messageHistory.length > 10) {
      messageHistory.shift();
    }

    io.emit('chat message', messageToSend);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const disconnectedUser = users.find(user => user.id === socket.id);
    if (disconnectedUser) {
      console.log(`❌ Utilisateur déconnecté : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);
    } else {
      console.log('❌ Utilisateur inconnu déconnecté');
    }

    users = users.filter(user => user.id !== socket.id);
    io.emit('user list', users);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
