import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Stockage des données en mémoire
let users = {}; // Utilisateurs enregistrés
let messageHistory = {}; // Historique des messages par salon
let roomUsers = {}; // Liste des utilisateurs dans chaque salon
let userChannels = {}; // Salon actuel de chaque utilisateur
let createdRooms = ['Général']; // Liste des salons existants, incluant le salon général

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`Nouvelle connexion : ${socket.id}`);

  // Envoi de la liste des salons existants au client
  socket.emit('existing rooms', createdRooms);

  // Envoi de l'historique du salon Général au client
  socket.emit('chat history', messageHistory['Général'] || []);

  // Définir le nom d'utilisateur
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    // Vérification de la validité du nom d'utilisateur
    if (!username || username.length > 16 || /\s/.test(username)) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    // Par défaut, rejoindre le salon général
    const currentChannel = 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    // Ajouter l'utilisateur dans la liste du salon général
    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel].push(userData);

    console.log(`Utilisateur enregistré : ${username}`);

    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
  });

  // Envoi de message dans un salon
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

    console.log(`${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);

    if (!messageHistory[currentChannel]) messageHistory[currentChannel] = [];
    messageHistory[currentChannel].push(messageToSend);

    // Limiter le nombre de messages dans l'historique (max 10)
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', messageToSend);
  });

  // Déconnexion d'un utilisateur
  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);
    
    if (disconnectedUser) {
      console.log(`Déconnexion de : ${disconnectedUser.username}`);

      // Retirer l'utilisateur de tous les salons
      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]);

        // Si le salon est vide, le supprimer
        if (roomUsers[channel].length === 0 && createdRooms.includes(channel) && channel !== 'Général') {
          console.log(`Le salon ${channel} est vide et va être supprimé.`);
          delete roomUsers[channel];
          delete messageHistory[channel];
          createdRooms = createdRooms.filter(room => room !== channel);

          io.emit('room deleted', channel);

          // Rediriger tous les utilisateurs du salon vers le salon général
          Object.keys(userChannels).forEach(socketId => {
            if (userChannels[socketId] === channel) {
              userChannels[socketId] = 'Général';
              io.to(socketId).emit('joinRoom', 'Général');
            }
          });
        }
      }

      // Supprimer l'utilisateur des données
      delete users[disconnectedUser.username];
      delete userChannels[socket.id];
    }
  });

  // Rejoindre un salon
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

    // Ajouter l'utilisateur dans la nouvelle liste du salon
    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age
    });

    console.log(`${user.username} a rejoint le salon : ${channel}`);

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
    // Si le salon existe déjà, refuser la création
    if (createdRooms.includes(newChannel)) {
      socket.emit('room exists', newChannel);
      return;
    }

    console.log(`Création du salon : ${newChannel}`);

    // Ajouter le salon à la liste des salons créés
    createdRooms.push(newChannel);
    messageHistory[newChannel] = []; // Historique vide pour le nouveau salon
    roomUsers[newChannel] = []; // Liste vide des utilisateurs
    console.log(`Salon créé : ${newChannel}`);

    // Joindre le créateur immédiatement dans le salon
    socket.join(newChannel);
    userChannels[socket.id] = newChannel;

    // Ajouter un message de bienvenue
    io.to(newChannel).emit('chat message', {
      username: 'Système',
      message: `Bienvenue dans le salon ${newChannel}`,
      channel: newChannel
    });

    // Rediriger l'utilisateur vers le salon qu'il a créé
    socket.emit('joinRoom', newChannel);
    io.emit('room created', newChannel);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
