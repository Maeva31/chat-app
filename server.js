import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Données en mémoire
let users = {};
let userRoles = {};
let messageHistory = {};
let roomUsers = {};
let userChannels = {};
let channels = ['Général', 'Musique', 'Gaming', 'Détente'];

channels.forEach((ch) => {
  messageHistory[ch] = [];
  roomUsers[ch] = [];
});

app.use(express.static('public'));

function escapeHTML(str) {
  return str.replace(/[&<>"]/g, (match) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[match]));
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  socket.emit('chat history', messageHistory['Général']);
  socket.emit('room list', channels);

  socket.on('createRoom', (newChannel) => {
    const channelName = newChannel?.trim();

    if (!channelName || channelName.length > 20 || channels.includes(channelName)) {
      socket.emit('error', 'Nom de salon invalide ou déjà existant');
      return;
    }

    const user = Object.values(users).find(u => u.id === socket.id);
    const role = user ? userRoles[user.username] : null;

    if (!user) {
      socket.emit('error', 'Utilisateur non identifié');
      return;
    }

    if (role === 'user') {
      socket.emit('error', 'Permission refusée : seuls les admins ou modérateurs peuvent créer un salon.');
      return;
    }

    channels.push(channelName);
    messageHistory[channelName] = [];
    roomUsers[channelName] = [];

    console.log(`✅ Salon créé : ${channelName}`);
    io.emit('room created', channelName);

    const oldChannel = userChannels[socket.id];
    socket.leave(oldChannel);
    socket.join(channelName);
    userChannels[socket.id] = channelName;

    roomUsers[channelName].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age,
      role: role
    });

    io.to(channelName).emit('user list', roomUsers[channelName]);
    socket.emit('chat history', messageHistory[channelName]);
  });

  socket.on('set username', (data) => {
    const { username, gender, age } = data;
    const usernameIsInvalid = !username || username.length > 16 || /\s/.test(username);

    if (usernameIsInvalid || !age || isNaN(age) || age < 18 || age > 89) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      const oldSocketId = users[username].id;
      io.to(oldSocketId).emit('kicked');
      io.sockets.sockets.get(oldSocketId)?.disconnect();
    }

    if (!userRoles[username]) {
      userRoles[username] = Object.keys(userRoles).length === 0 ? 'admin' : 'user';
    }

    const userData = { username, gender, age, id: socket.id, role: userRoles[username] };
    users[username] = userData;

    const currentChannel = userChannels[socket.id] || 'Général';
    userChannels[socket.id] = currentChannel;
    socket.join(currentChannel);

    if (!roomUsers[currentChannel]) roomUsers[currentChannel] = [];
    roomUsers[currentChannel].push({ ...userData });

    socket.emit('user data', userData);
    io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
  });

  socket.on('chat message', (msg) => {
    const { username, message, timestamp, channel } = msg;
    const user = users[username];

    if (!user || !channel || !channels.includes(channel)) return;

    const safeMessage = escapeHTML(message);
    const msgObj = {
      username,
      gender: user.gender,
      message: safeMessage,
      timestamp
    };

    messageHistory[channel].push(msgObj);
    if (messageHistory[channel].length > 100) messageHistory[channel].shift();

    io.to(channel).emit('chat message', msgObj);
  });

  socket.on('joinRoom', (newRoom) => {
    if (!channels.includes(newRoom)) return;

    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const oldRoom = userChannels[socket.id];
    socket.leave(oldRoom);

    roomUsers[oldRoom] = roomUsers[oldRoom]?.filter(u => u.id !== socket.id);

    socket.join(newRoom);
    userChannels[socket.id] = newRoom;

    if (!roomUsers[newRoom]) roomUsers[newRoom] = [];
    roomUsers[newRoom].push({
      id: socket.id,
      username: user.username,
      gender: user.gender,
      age: user.age,
      role: user.role
    });

    io.to(oldRoom).emit('user list', roomUsers[oldRoom]);
    io.to(newRoom).emit('user list', roomUsers[newRoom]);
    socket.emit('chat history', messageHistory[newRoom]);
  });

  socket.on('disconnect', () => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const username = user.username;
    const room = userChannels[socket.id];

    delete users[username];
    delete userChannels[socket.id];
    roomUsers[room] = roomUsers[room]?.filter(u => u.id !== socket.id);

    io.to(room).emit('user list', roomUsers[room]);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
