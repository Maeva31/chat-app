import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Données en mémoire
let users = {};            // Stockage des utilisateurs avec leurs infos
let messageHistory = {};   // Historique des messages par salon
let roomUsers = {};        // Utilisateurs présents par salon
let userChannels = {};     // Canal actuel de chaque utilisateur (socket.id)
let createdRooms = [];     // Salons créés dynamiquement ✅
const defaultRooms = ['Général']; // salon de base

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  // Envoi de la liste des salons existants au nouveau client
  socket.emit('existing rooms', [...defaultRooms, ...createdRooms]);

  // Envoi de l'historique du salon Général par défaut
  socket.emit('chat history', messageHistory['Général'] || []);

  // Définition du nom d'utilisateur
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);
    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    // Par défaut, rejoindre le salon Général
    const currentChannel = 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];

    // Évite les doublons
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
  });

  // Envoi d’un message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || 'Général';

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
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
      messageHistory[currentChannel].shift(); // max 10 messages
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);

    if (disconnectedUser) {
      console.log(`❌ Déconnexion : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      // Retirer l'utilisateur de tous les salons
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]);

        // Si le salon est vide, le supprimer et rediriger les utilisateurs vers le salon Général
        if (roomUsers[channel].length === 0) {
          console.log(`💀 Le salon ${channel} est maintenant vide et sera supprimé.`);
          delete roomUsers[channel];
          delete messageHistory[channel];
          createdRooms = createdRooms.filter(room => room !== channel);
          io.emit('room deleted', channel); // Notifier les autres clients

          // Rediriger tous les utilisateurs dans ce salon vers le salon Général
          Object.keys(userChannels).forEach((socketId) => {
            if (userChannels[socketId] === channel) {
              userChannels[socketId] = 'Général';
              io.to(socketId).emit('joinRoom', 'Général'); // Redirection vers le salon Général
            }
          });
        }
      }

      delete users[disconnectedUser.username];
      delete userChannels[socket.id];
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

    // Si l'utilisateur est déjà dans ce salon, ne rien faire
    if (oldChannel === channel) {
      socket.emit('alreadyInRoom', channel);
      return;
    }

    // Quitter l'ancien salon
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
    }

    socket.leave(oldChannel);
    socket.join(channel);
    userChannels[socket.id] = channel;

    if (!roomUsers[channel]) roomUsers[channel] = [];

    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age
    });

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
    // Vérification si le salon existe déjà
    if (!createdRooms.includes(newChannel)) {
      console.log(`✅ Création du salon demandé : ${newChannel}`);

      // Ajouter le salon créé à la liste
      createdRooms.push(newChannel);
      messageHistory[newChannel] = []; // Historique vide au début
      roomUsers[newChannel] = []; // Liste des utilisateurs vide
      console.log(`✅ Salon créé : ${newChannel}`);

      // Joindre immédiatement le créateur au nouveau salon
      socket.join(newChannel);
      userChannels[socket.id] = newChannel;

      // Émission de l'événement 'room created' à tous les clients
      io.emit('room created', newChannel);

      // Ajouter un message système de bienvenue dans le salon créé
      io.to(newChannel).emit('chat message', {
        username: 'Système',
        message: `Bienvenue dans le salon ${newChannel}`,
        channel: newChannel
      });

      // Rediriger le créateur vers le salon créé
      socket.emit('joinRoom', newChannel); // L'utilisateur rejoint le salon directement après sa création
    } else {
      socket.emit('room exists', newChannel);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
