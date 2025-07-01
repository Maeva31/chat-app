import { users } from './userManagement.js';
import { addMessageToHistory } from './roomManagement.js';

export function handleMessage(io, socket, msg, userChannels, bannedUsers, mutedUsers) {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  const channel = userChannels[socket.id] || 'Général';

  if (bannedUsers.has(user.username)) {
    socket.emit('error message', 'Vous êtes banni du serveur.');
    socket.emit('redirect', 'https://banned.maevakonnect.fr');
    return;
  }

  if (mutedUsers.has(user.username)) {
    socket.emit('error message', 'Vous êtes muté et ne pouvez pas envoyer de messages.');
    return;
  }

  const message = {
    username: user.username,
    gender: user.gender,
    role: user.role,
    message: msg.message || '',
    timestamp: msg.timestamp || new Date().toISOString(),
    channel
  };

  addMessageToHistory(channel, message);
  io.to(channel).emit('chat message', message);
}
