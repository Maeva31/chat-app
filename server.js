import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

let users = {};            // Tous les utilisateurs connectés (par pseudo)
let userChannels = {};     // Canal courant de chaque socket.id
let roomUsers = {};        // Liste des utilisateurs par salon
let messageHistory = {};   // Historique des messages par salon

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log(`✅ Connexion : ${socket.id}`);

  // Rejoindre "Général" par défaut
  const defaultRoom = 'Général';
  socket.join(defaultRoom);
  userChannels[socket.id] = defaultRoom;

  socket.emit('chat history', messageHistory[defaultRoom] || []);

  // Définir l'utilisateur
  socket.on('set username', (data) => {
    const { username, gender, age } = data;

    const isInvalid = !username || username.length > 16 || /\s/.test(username) || !age || isNaN(age) || age < 18 || age > 89;
    if (isInvalid) {
      socket.emit('username exists', username);
      return;
    }

    if (users[username] && users[username].id !== socket.id) {
      socket.emit('username exists', username);
      return;
    }

    const userData = { username, gender, age, id: socket.id };
    users[username] = userData;
    const currentRoom = userChannels[socket.id] || defaultRoom;
    socket.join(currentRoom);

    // Supprimer l'utilisateur de tous les salons avant de l'ajouter
    Object.keys(roomUsers).forEach(room => {
      roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
    });

    if (!roomUsers[currentRoom]) roomUsers[currentRoom] = [];
    roomUsers[currentRoom].push(userData);

    socket.emit('username accepted', username);
    socket.emit('chat history', messageHistory[currentRoom] || []);
    io.to(currentRoom).emit('user list', roomUsers[currentRoom]);
  });

  // Changement de salon
  socket.on('joinRoom', (room) => {
    const previousRoom = userChannels[socket.id] || defaultRoom;
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    socket.leave(previousRoom);
    socket.join(room);
    userChannels[socket.id] = room;

    // Retirer l'utilisateur de l'ancien salon
    if (roomUsers[previousRoom]) {
      roomUsers[previousRoom] = roomUsers[previousRoom].filter(u => u.id !== socket.id);
      io.to(previousRoom).emit('user list', roomUsers[previousRoom]);
    }

    // Supprimer des autres salons au cas où
    Object.keys(roomUsers).forEach(r => {
      roomUsers[r] = roomUsers[r].filter(u => u.id !== socket.id);
    });

    if (!roomUsers[room]) roomUsers[room] = [];
    if (!roomUsers[room].some(u => u.id === socket.id)) {
      roomUsers[room].push(user);
    }

    socket.emit('chat history', messageHistory[room] || []);
    io.to(room).emit('user list', roomUsers[room]);
  });

  // Envoi de message
  socket.on('chat message', (msg) => {
    const sender = Object.values(users).find(u => u.id === socket.id);
    const room = userChannels[socket.id] || defaultRoom;
    if (!sender || !msg.message) return;

    const messageToSend = {
      username: sender.username,
      gender: sender.gender,
      age: sender.age,
      message: msg.message,
      timestamp: msg.timestamp
    };

    if (!messageHistory[room]) messageHistory[room] = [];
    messageHistory[room].push(messageToSend);

    io.to(room).emit('chat message', messageToSend);
  });

  // Création de salon
  socket.on('createRoom', (roomName) => {
    if (!roomUsers[roomName]) {
      roomUsers[roomName] = [];
      io.emit('room created', roomName);
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    const room = userChannels[socket.id] || defaultRoom;
    const user = Object.values(users).find(u => u.id === socket.id);
    if (user) {
      delete users[user.username];
      roomUsers[room] = roomUsers[room]?.filter(u => u.id !== socket.id) || [];
      io.to(room).emit('user list', roomUsers[room]);
    }

    delete userChannels[socket.id];
    console.log(`❌ Déconnexion : ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur en écoute sur http://localhost:${PORT}`);
});
