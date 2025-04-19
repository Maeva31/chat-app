import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};                // { username: { id, username, gender, age } }
const messageHistory = {};       // { roomName: [messages...] }
const roomUsers = {};            // { roomName: [userObjects...] }
const userChannels = {};         // { socket.id: roomName }

app.use(express.static('public'));

// 🔌 Connexion Socket
io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  socket.emit('chat history', messageHistory['Général'] || []);

  // 📛 Authentification utilisateur
  socket.on('set username', ({ username, gender, age }) => {
    const invalidUsername = !username || username.length > 16 || /\s/.test(username);
    const invalidAge = !age || isNaN(age) || age < 18 || age > 89;

    if (invalidUsername || invalidAge) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { id: socket.id, username, gender, age };
    users[username] = userData;

    const channel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = channel;
    socket.join(channel);

    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel] = roomUsers[channel].filter(u => u.id !== socket.id);
    roomUsers[channel].push(userData);

    console.log(`👤 Utilisateur enregistré : ${username} (${gender}, ${age} ans)`);
    io.to(channel).emit('user list', roomUsers[channel]);
    socket.emit('username accepted', username);
  });

  // 📨 Envoi de message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(user => user.id === socket.id);
    if (!sender) return socket.emit('error', 'Utilisateur inconnu, message non envoyé.');

    const channel = userChannels[socket.id] || 'Général';
    const message = {
      username: sender.username,
      gender: sender.gender,
      message: msg.message || "",
      timestamp: msg.timestamp || new Date().toISOString(),
      channel
    };

    console.log(`💬 ${message.username} dans #${channel}: ${message.message}`);

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(message);
    if (messageHistory[channel].length > 50) messageHistory[channel].shift(); // conservons + de messages

    io.to(channel).emit('chat message', message);
  });

  // 🚪 Déconnexion
  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) {
      console.log(`❌ Déconnexion d'un utilisateur inconnu (ID: ${socket.id})`);
      return;
    }

    console.log(`❌ Déconnexion : ${user.username}`);
    io.emit('user disconnect', user.username);

    const channel = userChannels[socket.id];
    if (channel) {
      roomUsers[channel] = (roomUsers[channel] || []).filter(u => u.id !== socket.id);
      io.to(channel).emit('user list', roomUsers[channel]);
      io.to(channel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon.`,
        channel
      });
    }

    delete users[user.username];
    delete userChannels[socket.id];
  });

  // 🔄 Changement de salon
  socket.on('createRoom', (roomName) => {
    socket.emit('chat message', {
      username: 'Système',
      message: `Salon "${roomName}" créé !`,
      channel: roomName
    });

    socket.join(roomName);
    userChannels[socket.id] = roomName;
    if (!roomUsers[roomName]) roomUsers[roomName] = [];
    roomUsers[roomName].push(users[socket.id]);

    io.emit('user list', roomUsers[roomName]);
  });

  socket.on('joinRoom', (roomName) => {
    socket.join(roomName);
    userChannels[socket.id] = roomName;
    roomUsers[roomName].push(users[socket.id]);

    io.emit('user list', roomUsers[roomName]);
  });
});

server.listen(3000, () => {
  console.log('🚀 Server started on http://localhost:3000');
});
