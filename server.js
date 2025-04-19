const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server } = require('socket.io');
const io = new Server(http);
const path = require('path');

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const users = {};
const bannedUsers = {};
const mutedUsers = {};
const userChannels = {};
const messageHistory = {};
const userSockets = {};

function getDefaultChannel() {
    return 'général';
}

function getUserList(channel) {
    return Object.entries(users)
        .filter(([id, user]) => userChannels[id] === channel)
        .map(([id, user]) => ({
            id,
            ...user
        }));
}

function closeEmptyRoomIfNeeded(room) {
    const usersInRoom = Object.entries(userChannels)
        .filter(([id, chan]) => chan === room)
        .map(([id]) => id);

    const hasModerator = usersInRoom.some(
        (id) => users[id] && (users[id].role === 'admin' || users[id].role === 'modo')
    );

    if (!hasModerator && usersInRoom.length === 0 && room !== getDefaultChannel()) {
        delete messageHistory[room];
    }
}

io.on('connection', (socket) => {
    socket.on('auth', ({ pseudo, genre, age, role }) => {
        if (bannedUsers[pseudo]) {
            socket.emit('banned');
            return;
        }

        users[socket.id] = { pseudo, genre, age, role };
        userChannels[socket.id] = getDefaultChannel();
        userSockets[pseudo] = socket.id;
        socket.join(getDefaultChannel());

        socket.emit('messageHistory', messageHistory[getDefaultChannel()] || []);
        io.emit('userList', getUserList(getDefaultChannel()));
    });

    socket.on('message', ({ content, color, font }) => {
        const user = users[socket.id];
        const channel = userChannels[socket.id];
        if (!user || mutedUsers[user.pseudo]) return;

        const message = {
            id: Date.now(),
            pseudo: user.pseudo,
            genre: user.genre,
            age: user.age,
            role: user.role,
            content,
            color,
            font,
            channel
        };

        if (!messageHistory[channel]) messageHistory[channel] = [];
        messageHistory[channel].push(message);

        io.to(channel).emit('newMessage', message);
    });

    socket.on('privateMessage', ({ to, content }) => {
        const sender = users[socket.id];
        const receiverSocketId = userSockets[to];
        if (!sender || !receiverSocketId) return;

        const message = {
            from: sender.pseudo,
            to,
            content,
            timestamp: Date.now()
        };

        socket.emit('privateMessage', message);
        io.to(receiverSocketId).emit('privateMessage', message);
    });

    socket.on('createRoom', (room) => {
        const user = users[socket.id];
        if (!user || (user.role === 'user' && userChannels[socket.id] !== getDefaultChannel())) return;

        userChannels[socket.id] = room;
        socket.join(room);
        socket.emit('messageHistory', messageHistory[room] || []);
        io.emit('userList', getUserList(room));
    });

    socket.on('switchRoom', (room) => {
        const currentRoom = userChannels[socket.id];
        socket.leave(currentRoom);
        userChannels[socket.id] = room;
        socket.join(room);

        socket.emit('messageHistory', messageHistory[room] || []);
        io.emit('userList', getUserList(room));
    });

    socket.on('moderation', ({ action, target }) => {
        const actor = users[socket.id];
        if (!actor || (actor.role !== 'admin' && actor.role !== 'modo')) return;

        const targetSocketId = userSockets[target];
        if (!targetSocketId) return;

        switch (action) {
            case 'kick':
                io.to(targetSocketId).emit('kicked');
                io.sockets.sockets.get(targetSocketId)?.disconnect();
                break;
            case 'ban':
                bannedUsers[target] = true;
                io.to(targetSocketId).emit('banned');
                io.sockets.sockets.get(targetSocketId)?.disconnect();
                break;
            case 'mute':
                mutedUsers[target] = true;
                break;
        }
    });

    socket.on('disconnect', () => {
        const room = userChannels[socket.id];
        delete userSockets[users[socket.id]?.pseudo];
        delete users[socket.id];
        delete userChannels[socket.id];
        delete mutedUsers[socket.id];

        closeEmptyRoomIfNeeded(room);
        io.emit('userList', getUserList(room));
    });
});

http.listen(PORT, () => {
    console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
