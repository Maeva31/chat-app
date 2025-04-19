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

let channels = ['Général', 'Musique', 'Gaming', 'Détente'];  // Liste des salons
let roomUsers = {};  // Liste des utilisateurs dans chaque salon
let messageHistory = {};  // Historique des messages
let userData = {};  // Données des utilisateurs (pseudo, genre, âge)

// Fonction pour envoyer la liste des salons à tous les utilisateurs
function updateRoomList() {
  io.emit('room list', channels);  // Envoie la liste mise à jour à tous les utilisateurs
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  // Envoi de la liste des salons existants dès la connexion
  socket.emit('room list', channels);

  // Par défaut, on rejoint le salon "Général"
  socket.join('Général');
  roomUsers['Général'] = roomUsers['Général'] || [];
  roomUsers['Général'].push(socket.id);
  socket.emit('chat history', messageHistory['Général'] || []);

  // Envoi de la liste des utilisateurs du salon "Général"
  io.to('Général').emit('user list', roomUsers['Général']);

  // Événement pour définir les informations utilisateur (pseudo, genre, âge)
  socket.on('set username', (data) => {
    userData[socket.id] = data;  // Stocke les données utilisateur
    io.to('Général').emit('user list', roomUsers['Général']);  // Mise à jour de la liste des utilisateurs
  });

  // Création de salon
  socket.on('createRoom', (newChannel) => {
    if (!channels.includes(newChannel)) {
      channels.push(newChannel);
      roomUsers[newChannel] = [];
      messageHistory[newChannel] = [];
      io.emit('room created', newChannel);  // Informer tous les utilisateurs des salons
      io.emit('room list', channels);  // Mettre à jour la liste des salons pour tous les utilisateurs
    } else {
      socket.emit('room exists', newChannel);  // Salon déjà existant
    }
  });

  // Rejoindre un salon
  socket.on('joinRoom', (channel) => {
    const currentChannel = Object.keys(roomUsers).find(room => roomUsers[room].includes(socket.id)) || 'Général';

    // Quitter l'ancien salon
    socket.leave(currentChannel);
    roomUsers[currentChannel] = roomUsers[currentChannel].filter(userId => userId !== socket.id);

    // Rejoindre le nouveau salon
    socket.join(channel);
    roomUsers[channel] = roomUsers[channel] || [];
    roomUsers[channel].push(socket.id);

    // Envoi de l'historique des messages du salon
    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `Bienvenue dans le salon ${channel}`,
      timestamp: new Date().toISOString(),
    });

    // Mise à jour de la liste des utilisateurs du salon
    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Gestion des messages dans le salon
  socket.on('chat message', (msg) => {
    const currentChannel = Object.keys(roomUsers).find(room => roomUsers[room].includes(socket.id)) || 'Général';

    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(msg);

    // Limiter l'historique à 10 messages
    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();
    }

    io.to(currentChannel).emit('chat message', msg);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`❌ Déconnexion : ${socket.id}`);
    const currentChannel = Object.keys(roomUsers).find(room => roomUsers[room].includes(socket.id));

    if (currentChannel) {
      roomUsers[currentChannel] = roomUsers[currentChannel].filter(userId => userId !== socket.id);
      io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
      
      // Si le salon est vide, on le supprime
      if (roomUsers[currentChannel].length === 0) {
        channels = channels.filter(room => room !== currentChannel);
        delete roomUsers[currentChannel];
        delete messageHistory[currentChannel];
        io.emit('room list', channels);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
