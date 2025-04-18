import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

let channels = ['Général', 'Musique', 'Gaming', 'Détente'];
let users = {};            
let messageHistory = {};   
let roomUsers = {};        
let userChannels = {};     
let moderators = {}; // {channelName: {username: [moderators]}} 

// Fonction pour vérifier si un salon doit être supprimé
function checkAndCloseRoom(channel) {
  if (roomUsers[channel].length === 0) {
    delete roomUsers[channel];
    delete messageHistory[channel];
    channels = channels.filter(c => c !== channel);
    io.emit('room list', channels); // Notifie tous les utilisateurs que le salon a été supprimé
    console.log(`❌ Salon supprimé : ${channel}`);
  }
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  const defaultChannel = 'Général';
  socket.join(defaultChannel);
  socket.emit('chat history', messageHistory[defaultChannel] || []);

  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      channels.push(newChannel);
      console.log(`✅ Salon créé : ${newChannel}`);
      socket.join(newChannel);
      userChannels[socket.id] = newChannel;
      io.emit('room created', newChannel);
      socket.emit('chat history', messageHistory[newChannel] || []);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || defaultChannel;
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
    roomUsers[channel].push({ id: socket.id, username: user.username, gender: user.gender, age: user.age });

    console.log(`👥 ${user.username} a rejoint le salon : ${channel}`);
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a rejoint le salon ${channel}`,
      timestamp: new Date().toISOString(),
      channel
    });

    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const invalid = !username || username.length > 16 || /\s/.test(username) || !age || isNaN(age) || age < 18 || age > 89;
    if (invalid || (users[username] && users[username].id !== socket.id)) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || defaultChannel;
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];

    roomUsers[currentChannel] = roomUsers[currentChannel].filter(u => u.id !== socket.id);
    roomUsers[currentChannel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
    socket.emit('username accepted', username);
  });

  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    const currentChannel = userChannels[socket.id] || defaultChannel;

    const messageToSend = {
      username: sender ? sender.username : "Inconnu",
      gender: sender ? sender.gender : "Non précisé",
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel: currentChannel,
    };

    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(messageToSend);
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    console.log(`💬 ${messageToSend.username} dans #${currentChannel}: ${messageToSend.message}`);
    io.to(currentChannel).emit('chat message', messageToSend);
  });

  socket.on('disconnect', () => {
    const disconnectedUser = Object.values(users).find(user => user.id === socket.id);

    if (disconnectedUser) {
      console.log(`❌ Déconnexion : ${disconnectedUser.username}`);
      io.emit('user disconnect', disconnectedUser.username);

      for (const channel in roomUsers) {
        roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
        io.to(channel).emit('user list', roomUsers[channel]);
        checkAndCloseRoom(channel);  // Vérifie si le salon doit être fermé
      }

      delete users[disconnectedUser.username];
      delete userChannels[socket.id];
    } else {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
    }
  });

  // Ajout d'un modérateur à un salon
  socket.on('add moderator', (data) => {
    const { channel, username } = data;

    if (!moderators[channel]) moderators[channel] = [];

    const isUserOwner = moderators[channel].includes(username);
    if (isUserOwner) {
      moderators[channel].push(username);
      io.to(channel).emit('moderator added', { username, channel });
      console.log(`✅ ${username} a été ajouté en tant que modérateur dans le salon ${channel}`);
    } else {
      socket.emit('error', 'Vous n\'êtes pas autorisé à ajouter des modérateurs');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
