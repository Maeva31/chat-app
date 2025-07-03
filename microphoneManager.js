const MAX_MIC_USERS = 3;
const micAccessPerRoom = {}; // { roomName: [socketId1, socketId2, ...] }

export default function configureMicrophone(io) {
  io.on('connection', (socket) => {

    socket.on('requestMic', (roomName) => {
      if (!roomName) return;

      if (!micAccessPerRoom[roomName]) {
        micAccessPerRoom[roomName] = [];
      }

      const currentUsers = micAccessPerRoom[roomName];

      if (currentUsers.includes(socket.id)) {
        socket.emit('mic status', { granted: true, users: currentUsers });
        return;
      }

      if (currentUsers.length < MAX_MIC_USERS) {
        micAccessPerRoom[roomName].push(socket.id);
        socket.emit('mic status', { granted: true, users: micAccessPerRoom[roomName] });
        io.to(roomName).emit('mic users', micAccessPerRoom[roomName]);
      } else {
        socket.emit('mic status', { granted: false, reason: 'Nombre maximal de micros atteint' });
      }
    });

    socket.on('releaseMic', (roomName) => {
      if (!roomName || !micAccessPerRoom[roomName]) return;

      micAccessPerRoom[roomName] = micAccessPerRoom[roomName].filter(id => id !== socket.id);
      io.to(roomName).emit('mic users', micAccessPerRoom[roomName]);
    });

    socket.on('requestAllMicUsers', () => {
      const filteredMicAccess = {};
      for (const room in micAccessPerRoom) {
        if (room !== 'Général') {
          filteredMicAccess[room] = micAccessPerRoom[room];
        }
      }
      socket.emit('allMicUsers', filteredMicAccess);
    });

    socket.on('disconnect', () => {
      for (const room in micAccessPerRoom) {
        micAccessPerRoom[room] = micAccessPerRoom[room].filter(id => id !== socket.id);
        io.to(room).emit('mic users', micAccessPerRoom[room]);
      }
    });
  });
}
