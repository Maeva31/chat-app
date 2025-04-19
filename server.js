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
let roomModerators = {};   // Modérateurs par salon
let roomCreators = {};     // Créateurs des salons

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

    const currentChannel = userChannels[socket.id] || 'Général';
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
      }

      // Fermeture du salon si le créateur et tous les modérateurs en sont partis
      for (const channel in roomUsers) {
        if (roomUsers[channel].length === 0 || 
            (roomCreators[channel] && !roomUsers[channel].some(user => user.id === roomCreators[channel].id)) ||
            (roomModerators[channel] && !roomUsers[channel].some(user => user.id === roomModerators[channel].id))) {
          delete roomUsers[channel];
          delete messageHistory[channel];
          delete roomModerators[channel];
          delete roomCreators[channel];
          io.emit('room closed', channel);
          console.log(`❌ Le salon ${channel} a été fermé car il est vide ou sans créateur/modérateur.`);
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
    if (!createdRooms.includes(newChannel)) {
      createdRooms.push(newChannel);
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      roomCreators[newChannel] = { id: socket.id, username: users[socket.id].username };
      roomModerators[newChannel] = [];

      socket.emit('room created', newChannel);
      socket.join(newChannel);

      console.log(`✅ Salon créé : ${newChannel}`);
      io.emit('room created', newChannel);
      io.to(newChannel).emit('chat message', {
        username: 'Système',
        message: `Le salon ${newChannel} a été créé par ${users[socket.id].username}.`,
        channel: newChannel
      });
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Ajouter un modérateur
  socket.on('addModerator', (channel, username) => {
    if (roomCreators[channel].id === socket.id || roomModerators[channel].some(user => user.id === socket.id)) {
      const user = Object.values(users).find(u => u.username === username);
      if (user && !roomModerators[channel].some(u => u.id === user.id)) {
        roomModerators[channel].push({ id: user.id, username: user.username });
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a été ajouté en tant que modérateur.`,
          channel
        });
        console.log(`✅ ${user.username} ajouté en tant que modérateur dans ${channel}`);
      }
    }
  });

  // Expulser un utilisateur
  socket.on('kickUser', (channel, username) => {
    if (roomCreators[channel].id === socket.id || roomModerators[channel].some(user => user.id === socket.id)) {
      const user = Object.values(users).find(u => u.username === username);
      if (user) {
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a été expulsé du salon.`,
          channel
        });
        socket.to(user.id).emit('kicked');
        socket.leave(channel);
        roomUsers[channel] = roomUsers[channel].filter(u => u.id !== user.id);
        io.to(channel).emit('user list', roomUsers[channel]);
        console.log(`❌ ${user.username} expulsé du salon ${channel}`);
      }
    }
  });

  // Bannir un utilisateur
  socket.on('banUser', (channel, username) => {
    if (roomCreators[channel].id === socket.id || roomModerators[channel].some(user => user.id === socket.id)) {
      const user = Object.values(users).find(u => u.username === username);
      if (user) {
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} a été banni du salon.`,
          channel
        });
        socket.to(user.id).emit('banned');
        socket.leave(channel);
        roomUsers[channel] = roomUsers[channel].filter(u => u.id !== user.id);
        io.to(channel).emit('user list', roomUsers[channel]);
        console.log(`❌ ${user.username} banni du salon ${channel}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
