export function logout(socket, users, userChannels, roomUsers, io, cleanupEmptyDynamicRooms) {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  const room = userChannels[socket.id];
  if (room && !user.invisible) {
    io.to(room).emit('chat message', {
      username: 'Système',
      message: `${user.username} a quitté le serveur (logout)`,
      timestamp: new Date().toISOString(),
      channel: room
    });
  }

  if (roomUsers[room]) {
    roomUsers[room] = roomUsers[room].filter(u => u.id !== socket.id);
    io.to(room).emit('user list', roomUsers[room].filter(u => !u.invisible));
  }

  delete users[user.username];
  delete userChannels[socket.id];
  socket.disconnect(true);
  cleanupEmptyDynamicRooms();
}