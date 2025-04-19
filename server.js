import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const roomUsers = { 'Général': [] };
const createdRooms = ['Général'];
const messageHistory = { 'Général': [] };
const userChannels = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log(`🔌 Connexion : ${socket.id}`);
    
    // Envoi des salons existants et de l'historique du salon 'Général'
    socket.emit('existing rooms', createdRooms);
    socket.emit('chat history', messageHistory['Général']);

    // Gestion de l'attribution du pseudo
    socket.on('set username', ({ username, gender, age }) => {
        if (!username || users[username]) {
            socket.emit('username exists', username);
            return;
        }

        const user = { id: socket.id, username, gender, age };
        users[username] = user;
        userChannels[socket.id] = 'Général';
        roomUsers['Général'].push(user);
        socket.join('Général');

        socket.emit('username accepted', username);
        io.to('Général').emit('user list', roomUsers['Général']);
    });

    // Gestion de l'envoi de message
    socket.on('chat message', (data) => {
        const user = Object.values(users).find(u => u.id === socket.id);
        if (!user) return;

        const room = userChannels[socket.id] || 'Général';
        const message = {
            username: user.username,
            gender: user.gender,
            message: data.message,
            timestamp: new Date()
        };

        messageHistory[room] = messageHistory[room] || [];
        messageHistory[room].push(message);
        if (messageHistory[room].length > 10) messageHistory[room].shift();

        io.to(room).emit('chat message', message);
    });

    // Création d'un nouveau salon
    socket.on('createRoom', (newRoom) => {
        if (createdRooms.includes(newRoom)) {
            socket.emit('room exists', newRoom);
            return;
        }

        createdRooms.push(newRoom);
        roomUsers[newRoom] = [];
        messageHistory[newRoom] = [];

        io.emit('room created', newRoom);

        switchRoom(socket, newRoom);
        const user = getUser(socket.id);
        io.to(newRoom).emit('chat message', {
            username: 'Système',
            message: `Bienvenue dans le salon ${newRoom}`,
        });
    });

    // Joindre un salon existant
    socket.on('joinRoom', (room) => {
        if (!createdRooms.includes(room)) return;
        switchRoom(socket, room);
    });

    // Déconnexion d'un utilisateur
    socket.on('disconnect', () => {
        const user = getUser(socket.id);
        if (!user) return;

        const currentRoom = userChannels[socket.id];
        leaveRoom(socket, currentRoom);

        delete users[user.username];
        delete userChannels[socket.id];
    });

    // Fonction pour récupérer un utilisateur par socket.id
    function getUser(socketId) {
        return Object.values(users).find(u => u.id === socketId);
    }

    // Fonction pour quitter un salon
    function leaveRoom(socket, room) {
        const user = getUser(socket.id);
        if (!user || !roomUsers[room]) return;

        socket.leave(room);
        roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
        io.to(room).emit('user list', roomUsers[room]);

        // Supprimer le salon s’il est vide et ≠ "Général"
        if (room !== 'Général' && roomUsers[room].length === 0) {
            delete roomUsers[room];
            delete messageHistory[room];
            const index = createdRooms.indexOf(room);
            if (index > -1) createdRooms.splice(index, 1);
            io.emit('room deleted', room);
        }
    }

    // Fonction pour changer de salon
    function switchRoom(socket, newRoom) {
        const oldRoom = userChannels[socket.id];
        if (oldRoom === newRoom) return;

        leaveRoom(socket, oldRoom);

        const user = getUser(socket.id);
        if (!user) return;

        socket.join(newRoom);
        userChannels[socket.id] = newRoom;

        if (!roomUsers[newRoom]) roomUsers[newRoom] = [];  // Assure que le salon existe
        if (!messageHistory[newRoom]) messageHistory[newRoom] = [];  // Assure que l'historique du salon existe

        roomUsers[newRoom].push(user);
        io.to(newRoom).emit('user list', roomUsers[newRoom]);
        socket.emit('chat history', messageHistory[newRoom]);
        socket.emit('joinRoom', newRoom);  // Événement pour le client
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Serveur lancé : http://localhost:${PORT}`);
});
