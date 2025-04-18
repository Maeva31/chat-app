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
let users = {};            
let messageHistory = {};   
let roomUsers = {};        
let userChannels = {};     

// Fonction pour envoyer la liste des salons à tous les utilisateurs
function updateRoomList() {
  io.emit('room list', channels);  // Envoie la liste mise à jour à tous les utilisateurs
}

// Vérifier si un salon peut être supprimé si personne n'y est
function checkAndCloseRoom(channel) {
  if (roomUsers[channel] && roomUsers[channel].length === 0) {
    delete roomUsers[channel];
    delete messageHistory[channel];
    channels = channels.filter(c => c !== channel);
    updateRoomList();  // Mise à jour de la liste des salons
    console.log(`❌ Salon supprimé : ${channel}`);
  }
}

io.on('connection', (socket) => {
  console.log(`✅ Nouvelle connexion : ${socket.id}`);

  // On rejoint le salon "Général" par défaut
  socket.join('Général');
  userChannels[socket.id] = 'Général';
  socket.emit('chat history', messageHistory['Général'] || []);

  // Envoi de la liste des salons à l'utilisateur qui se connecte
  socket.emit('room list', channels);

  // Création d’un salon
  socket.on('createRoom', (newChannel) => {
    if (!messageHistory[newChannel]) {
      messageHistory[newChannel] = [];
      roomUsers[newChannel] = [];
      channels.push(newChannel);

      console.log(`✅ Salon créé : ${newChannel}`);
      
      // Mise à jour de la liste des salons pour tous les utilisateurs
      updateRoomList();

      // L'utilisateur est redirigé dans le nouveau salon
      socket.join(newChannel);
      userChannels[socket.id] = newChannel;
      
      // Envoyer l'historique des messages du salon
      socket.emit('room created', newChannel);
      socket.emit('chat history', messageHistory[newChannel] || []);
    } else {
      socket.emit('room exists', newChannel);
    }
  });

  // Rejoindre un salon
  socket.on('joinRoom', (channel) => {
    const oldChannel = userChannels[socket.id] || 'Général';

    // Quitter l'ancien salon
    socket.leave(oldChannel);
    
    // Rejoindre le nouveau salon
    socket.join(channel);
    userChannels[socket.id] = channel;

    // Ajouter l'utilisateur dans la liste des utilisateurs du salon
    if (!roomUsers[channel]) roomUsers[channel] = [];
    roomUsers[channel].push(socket.id);

    // Informer le salon qu'un utilisateur a rejoint
    socket.emit('chat history', messageHistory[channel] || []);
    io.to(channel).emit('chat message', {
      username: 'Système',
      message: `Bienvenue dans le salon ${channel}`,
      timestamp: new Date().toISOString(),
    });

    io.to(channel).emit('user list', roomUsers[channel]);
  });

  // Envoi de message
  socket.on('chat message', (msg) => {
    const currentChannel = userChannels[socket.id] || 'Général';

    // Ajouter le message à l'historique du salon
    if (!messageHistory[currentChannel]) {
      messageHistory[currentChannel] = [];
    }

    messageHistory[currentChannel].push(msg);

    if (messageHistory[currentChannel].length > 10) {
      messageHistory[currentChannel].shift();  // Limiter l'historique à 10 messages
    }

    io.to(currentChannel).emit('chat message', msg);
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`❌ Déconnexion : ${socket.id}`);
    const currentChannel = userChannels[socket.id];

    if (roomUsers[currentChannel]) {
      roomUsers[currentChannel] = roomUsers[currentChannel].filter(userId => userId !== socket.id);
      io.to(currentChannel).emit('user list', roomUsers[currentChannel]);
      checkAndCloseRoom(currentChannel);  // Vérifie si le salon peut être supprimé
    }

    delete userChannels[socket.id];
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
