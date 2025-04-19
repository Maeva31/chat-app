import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Stockage des données
let users = {}; // Liste des utilisateurs connectés
let roomUsers = {}; // Liste des utilisateurs par salon
let createdRooms = ['Général']; // Liste des salons existants, avec le salon général par défaut
let messageHistory = {}; // Historique des messages par salon
let userChannels = {}; // Salon actuel de chaque utilisateur

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`Nouvelle connexion : ${socket.id}`);

    // Envoi des salons existants
    socket.emit('existing rooms', createdRooms);
    socket.emit('chat history', messageHistory['Général'] || []);

    // Définir le nom d'utilisateur
    socket.on('set username', (data) => {
        const { username, gender, age } = data;

        if (!username || users[username]) {
            socket.emit('username exists', username);
            return;
        }

        users[username] = { id: socket.id, username, gender, age };
        userChannels[socket.id] = 'Général';
        roomUsers['Général'] = roomUsers['Général'] || [];
        roomUsers['Général'].push(users[username]);

        socket.join('Général');
        io.to('Général').emit('user list', roomUsers['Général']);
        socket.emit('username accepted', username);
    });

    // Envoi de message dans le chat
    socket.on('chat message', (msg) => {
        const sender = users[Object.keys(users).find(user => users[user].id === socket.id)];
        const currentChannel = userChannels[socket.id] || 'Général';
        const message = { username: sender.username, message: msg.message, timestamp: new Date() };

        if (!messageHistory[currentChannel]) messageHistory[currentChannel] = [];
        messageHistory[currentChannel].push(message);

        if (messageHistory[currentChannel].length > 10) messageHistory[currentChannel].shift();

        io.to(currentChannel).emit('chat message', message);
    });

    // Déconnexion d'un utilisateur
    socket.on('disconnect', () => {
        const disconnectedUser = Object.values(users).find(user => user.id === socket.id);
        if (disconnectedUser) {
            // Retirer l'utilisateur des salons
            for (let channel in roomUsers) {
                roomUsers[channel] = roomUsers[channel].filter(user => user.id !== socket.id);
                io.to(channel).emit('user list', roomUsers[channel]);

                // Si le salon est vide, le supprimer
                if (roomUsers[channel].length === 0 && createdRooms.includes(channel) && channel !== 'Général') {
                    delete roomUsers[channel];
                    delete messageHistory[channel];
                    createdRooms = createdRooms.filter(room => room !== channel);
                    io.emit('room deleted', channel);

                    // Rediriger tous les utilisateurs vers le salon général
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
        const user = users[Object.keys(users).find(user => users[user].id === socket.id)];

        // Ne rien faire si l'utilisateur est déjà dans le salon
        if (oldChannel === channel) {
            socket.emit('alreadyInRoom', channel);
            return;
        }

        // Quitter l'ancien salon
        if (roomUsers[oldChannel]) {
            roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
            io.to(oldChannel).emit('user list', roomUsers[oldChannel]);
        }

        // Rejoindre le nouveau salon
        socket.leave(oldChannel);
        socket.join(channel);
        userChannels[socket.id] = channel;

        roomUsers[channel] = roomUsers[channel] || [];
        roomUsers[channel].push({
            id: socket.id,
            username: user.username,
            gender: user.gender,
            age: user.age
        });

        io.to(channel).emit('chat message', { username: 'Système', message: `${user.username} a rejoint le salon ${channel}`, channel });
        io.to(channel).emit('user list', roomUsers[channel]);
        socket.emit('chat history', messageHistory[channel] || []);
    });

    // Création de salon
    socket.on('createRoom', (newChannel) => {
        if (createdRooms.includes(newChannel)) {
            socket.emit('room exists', newChannel);
            return;
        }

        createdRooms.push(newChannel);
        messageHistory[newChannel] = [];
        roomUsers[newChannel] = [];

        console.log(`Salon créé : ${newChannel}`);

        socket.join(newChannel);
        userChannels[socket.id] = newChannel;

        // Message de bienvenue dans le nouveau salon
        io.to(newChannel).emit('chat message', {
            username: 'Système',
            message: `Bienvenue dans le salon ${newChannel}`,
            channel: newChannel
        });

        io.emit('room created', newChannel);

        // Rediriger l'utilisateur vers le salon qu'il a créé
        socket.emit('joinRoom', newChannel);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
