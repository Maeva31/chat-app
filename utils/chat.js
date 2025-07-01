export function handleChatMessage(socket, msg, user, messageHistory, channel, io, bannedUsers, mutedUsers) {
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

  if (!messageHistory[channel]) messageHistory[channel] = [];
  messageHistory[channel].push(message);
  if (messageHistory[channel].length > 10) messageHistory[channel].shift();

  io.to(channel).emit('chat message', message);
}