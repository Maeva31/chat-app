import express from 'express';
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = {};
const userSockets = {};
const bannedUsers = new Set();
const mutedUsers = new Set();
const messageHistory = {};
const userChannels = {};

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.on('auth', ({ pseudo, genre, age, role }) => {
        if (bannedUsers.has(pseudo)) {
            socket.emit('banned');
            socket.disconnect();
            return;
        }

        users[socket.id] = { pseudo, genre, age, role };
        userSockets[pseudo] = socket;
        const channel = 'Salon Général';
        userChannels[socket.id] = channel;
        socket.join(channel);

        if (!messageHistory[channel]) messageHistory[channel] = [];
        socket.emit('history', messageHistory[channel]);
        updateUserList();

        socket.to(channel).emit('user-joined', pseudo);
    });

    socket.on('send-message', ({ text, font, color }) => {
        const user = users[socket.id];
        if (!user || mutedUsers.has(user.pseudo)) return;

        const channel = userChannels[socket.id];
        const msg = { ...user, text, font, color, time: new Date().toLocaleTimeString() };

        messageHistory[channel] = messageHistory[channel] || [];
        messageHistory[channel].push(msg);
        if (messageHistory[channel].length > 100) messageHistory[channel].shift();

        io.to(channel).emit('new-message', msg);
    });

    socket.on('private-message', ({ to, message }) => {
        const sender = users[socket.id];
        const receiverSocket = userSockets[to];
        if (sender && receiverSocket) {
            receiverSocket.emit('private-message', {
                from: sender.pseudo,
                message,
                time: new Date().toLocaleTimeString()
            });
        }
    });

    socket.on('send-file', ({ type, fileData, fileName }) => {
        const user = users[socket.id];
        if (!user || mutedUsers.has(user.pseudo)) return;
        const channel = userChannels[socket.id];

        const fileMsg = {
            ...user,
            fileType: type,
            fileData,
            fileName,
            time: new Date().toLocaleTimeString()
        };

        io.to(channel).emit('file-message', fileMsg);
    });

    socket.on('create-room', ({ name, color }) => {
        const user = users[socket.id];
        if (!user || user.role === 'user') {
            socket.emit('error', 'Seuls les modérateurs ou admins peuvent créer un salon.');
            return;
        }

        userChannels[socket.id] = name;
        socket.join(name);
        if (!messageHistory[name]) messageHistory[name] = [];

        socket.emit('room-created', { name, color });
        socket.emit('history', messageHistory[name]);
        updateUserList();
    });

    socket.on('switch-room', (roomName) => {
        const user = users[socket.id];
        const oldRoom = userChannels[socket.id];
        socket.leave(oldRoom);
        socket.join(roomName);
        userChannels[socket.id] = roomName;

        if (!messageHistory[roomName]) messageHistory[roomName] = [];

        socket.emit('history', messageHistory[roomName]);
        updateUserList();
    });

    socket.on('kick', (targetPseudo) => {
        const actor = users[socket.id];
        const targetSocket = Object.entries(users).find(([, u]) => u.pseudo === targetPseudo)?.[0];
        if (actor?.role === 'admin' && targetSocket) {
            io.to(targetSocket).emit('kicked');
            io.sockets.sockets.get(targetSocket)?.disconnect();
        }
    });

    socket.on('ban', (targetPseudo) => {
        const actor = users[socket.id];
        const targetSocket = Object.entries(users).find(([, u]) => u.pseudo === targetPseudo)?.[0];
        if (actor?.role === 'admin' && targetSocket) {
            bannedUsers.add(targetPseudo);
            io.to(targetSocket).emit('banned');
            io.sockets.sockets.get(targetSocket)?.disconnect();
        }
    });

    socket.on('mute', (targetPseudo) => {
        const actor = users[socket.id];
        if (actor?.role !== 'admin' && actor?.role !== 'modo') return;
        mutedUsers.add(targetPseudo);
    });

    socket.on('unmute', (targetPseudo) => {
        mutedUsers.delete(targetPseudo);
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            const channel = userChannels[socket.id];
            delete users[socket.id];
            delete userChannels[socket.id];
            delete userSockets[user.pseudo];

            // Supprimer salon si vide et sans modo/admin
            const stillInRoom = Object.entries(userChannels)
                .filter(([id, room]) => room === channel)
                .map(([id]) => users[id]);

            const hasModOrAdmin = stillInRoom.some(u => u?.role !== 'user');

            if (stillInRoom.length === 0 || !hasModOrAdmin) {
                delete messageHistory[channel];
            }

            updateUserList();
        }
    });

    function updateUserList() {
        const list = Object.values(users).map(u => ({
            pseudo: u.pseudo,
            genre: u.genre,
            age: u.age,
            role: u.role
        }));

        io.emit('user-list', list);
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
