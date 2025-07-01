import fs from 'fs';

const MAX_HISTORY = 10;
const MAX_ROOMS = 50;
const defaultRooms = ['Général', 'Musique', 'Gaming', 'Détente'];

let savedRooms = [];
try {
  const data = fs.readFileSync('rooms.json', 'utf-8');
  savedRooms = JSON.parse(data);
} catch {
  savedRooms = [...defaultRooms];
}
savedRooms = [...new Set([...defaultRooms, ...savedRooms])];

const messageHistory = {};
const roomUsers = {};

// Init
savedRooms.forEach(room => {
  if (!messageHistory[room]) messageHistory[room] = [];
  if (!roomUsers[room]) roomUsers[room] = [];
});

function saveRooms() {
  fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
}

export function getRooms() {
  return savedRooms;
}

export function cleanupEmptyRooms(io) {
  for (const room of savedRooms) {
    if (!defaultRooms.includes(room)) {
      if (roomUsers[room] && roomUsers[room].length === 0) {
        delete messageHistory[room];
        delete roomUsers[room];
        savedRooms = savedRooms.filter(r => r !== room);
        saveRooms();
        console.log(`❌ Salon supprimé (vide) : ${room}`);
        io.emit('room list', savedRooms);
      }
    }
  }
  updateRoomUserCounts(io);
}

export function updateRoomUserCounts(io) {
  const counts = {};
  for (const [channel, list] of Object.entries(roomUsers)) {
    counts[channel] = list.filter(u => !u.invisible).length;
  }
  io.emit('roomUserCounts', counts);
}

export function emitUserList(io, channel) {
  if (!roomUsers[channel]) return;
  const visibleUsers = roomUsers[channel].filter(u => !u.invisible);
  io.to(channel).emit('user list', visibleUsers);
}

export function joinRoom(io, socket, newChannel, userChannels, users) {
  const defaultChannel = 'Général';
  if (typeof newChannel !== 'string' || !newChannel.trim() || newChannel.length > 20 || /\s/.test(newChannel)) {
    socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
    return;
  }
  const oldChannel = userChannels[socket.id] || defaultChannel;
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  if (!messageHistory[newChannel]) messageHistory[newChannel] = [];
  if (!roomUsers[newChannel]) roomUsers[newChannel] = [];

  if (oldChannel !== newChannel) {
    socket.leave(oldChannel);
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      emitUserList(io, oldChannel);
    }

    userChannels[socket.id] = newChannel;
    socket.join(newChannel);

    roomUsers[newChannel] = roomUsers[newChannel].filter(u => u.id !== socket.id);
    roomUsers[newChannel].push(user);

    if (!user.invisible) {
      io.to(newChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a rejoint le salon ${newChannel}`,
        timestamp: new Date().toISOString(),
        channel: newChannel
      });
      io.to(oldChannel).emit('chat message', {
        username: 'Système',
        message: `${user.username} a quitté le salon ${oldChannel}`,
        timestamp: new Date().toISOString(),
        channel: oldChannel
      });
    }
  } else {
    if (!roomUsers[newChannel].some(u => u.id === socket.id)) {
      roomUsers[newChannel].push(user);
    }
  }

  socket.emit('chat history', messageHistory[newChannel]);
  emitUserList(io, newChannel);
  socket.emit('joinedRoom', newChannel);
  updateRoomUserCounts(io);
  cleanupEmptyRooms(io);
}

export function createRoom(io, socket, newChannel, userChannels, users) {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  if (typeof newChannel !== 'string' || !newChannel.trim() || newChannel.length > 20 || /\s/.test(newChannel)) {
    socket.emit('error', "Nom de salon invalide (pas d'espaces, max 20 caractères).");
    return;
  }

  if (savedRooms.includes(newChannel)) {
    socket.emit('room exists', newChannel);
    return;
  }

  if (savedRooms.length >= MAX_ROOMS) {
    socket.emit('error', 'Nombre maximum de salons atteint.');
    return;
  }

  messageHistory[newChannel] = [];
  roomUsers[newChannel] = [];
  savedRooms.push(newChannel);
  savedRooms = [...new Set(savedRooms)];
  saveRooms();
  console.log(`🆕 Salon créé : ${newChannel}`);

  const oldChannel = userChannels[socket.id];
  if (oldChannel && oldChannel !== newChannel) {
    socket.leave(oldChannel);
    if (roomUsers[oldChannel]) {
      roomUsers[oldChannel] = roomUsers[oldChannel].filter(u => u.id !== socket.id);
      emitUserList(io, oldChannel);
    }
    io.to(oldChannel).emit('chat message', {
      username: 'Système',
      message: `${user.username} a quitté le salon ${oldChannel}`,
      timestamp: new Date().toISOString(),
      channel: oldChannel
    });
  }

  userChannels[socket.id] = newChannel;
  socket.join(newChannel);
  roomUsers[newChannel].push(user);
  console.log(`${user.username} a rejoint le salon ${newChannel}`);

  socket.emit('room created', newChannel);
  io.emit('room list', savedRooms);
  updateRoomUserCounts(io);
  socket.emit('chat history', messageHistory[newChannel]);

  io.to(newChannel).emit('chat message', {
    username: 'Système',
    message: `Bienvenue dans le salon ${newChannel}!`,
    timestamp: new Date().toISOString(),
    channel: newChannel
  });

  emitUserList(io, newChannel);
  socket.emit('joinedRoom', newChannel);
  cleanupEmptyRooms(io);
}

export function getMessageHistory(channel) {
  return messageHistory[channel] || [];
}

export function addMessageToHistory(channel, message) {
  if (!messageHistory[channel]) messageHistory[channel] = [];
  messageHistory[channel].push(message);
  if (messageHistory[channel].length > MAX_HISTORY) {
    messageHistory[channel].shift();
  }
}

export { roomUsers, messageHistory };
