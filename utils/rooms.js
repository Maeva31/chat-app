import fs from 'fs';

export function updateRoomUserCounts(roomUsers, io) {
  const counts = {};
  for (const [channel, list] of Object.entries(roomUsers)) {
    counts[channel] = list.filter(u => !u.invisible).length;
  }
  io.emit('roomUserCounts', counts);
}

export function emitUserList(channel, roomUsers, io) {
  if (!roomUsers[channel]) return;
  const visibleUsers = roomUsers[channel].filter(u => !u.invisible);
  io.to(channel).emit('user list', visibleUsers);
}

export function cleanupEmptyDynamicRooms(roomUsers, messageHistory, savedRooms, defaultRooms, io) {
  for (const room of savedRooms) {
    if (!defaultRooms.includes(room) && roomUsers[room]?.length === 0) {
      delete messageHistory[room];
      delete roomUsers[room];
      savedRooms.splice(savedRooms.indexOf(room), 1);
      fs.writeFileSync('rooms.json', JSON.stringify(savedRooms, null, 2));
      io.emit('room list', savedRooms);
    }
  }
  updateRoomUserCounts(roomUsers, io);
}
