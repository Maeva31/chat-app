export function handleModerationCommand(socket, command, user, users, bannedUsers, mutedUsers, io, userChannels, roomUsers) {
  const args = command.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const targetName = args[1];
  const targetUser = users[targetName];
  const isProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');
  const isModo = user.role === 'modo';

  const disconnectWithRedirect = (id, url) => {
    io.to(id).emit('redirect', url);
    setTimeout(() => io.sockets.sockets.get(id)?.disconnect(true), 1500);
  };

  switch (cmd) {
    case '/ban':
      if (isModo && isProtected) return socket.emit('error message', 'Impossible de bannir ce membre.');
      if (targetUser) {
        bannedUsers.add(targetName);
        io.emit('server message', `${targetName} a été banni par ${user.username}`);
        disconnectWithRedirect(targetUser.id, 'https://banned.maevakonnect.fr');
      }
      break;

    case '/kick':
      if (isModo && isProtected) return socket.emit('error message', 'Impossible d’expulser ce membre.');
      if (targetUser) {
        io.emit('server message', `${targetName} a été expulsé par ${user.username}`);
        disconnectWithRedirect(targetUser.id, 'https://maevakonnect.fr');
      }
      break;

    case '/mute':
      if (isModo && isProtected) return socket.emit('error message', 'Impossible de muter ce membre.');
      if (targetUser) {
        mutedUsers.add(targetName);
        io.emit('server message', `${targetName} a été muté par ${user.username}`);
        io.to(targetUser.id).emit('muted');
      }
      break;

    case '/unmute':
      if (mutedUsers.has(targetName)) {
        mutedUsers.delete(targetName);
        io.emit('server message', `${targetName} a été unmuté par ${user.username}`);
        if (targetUser) io.to(targetUser.id).emit('unmuted');
      }
      break;

    case '/unban':
      if (bannedUsers.has(targetName)) {
        bannedUsers.delete(targetName);
        io.emit('server message', `${targetName} a été débanni par ${user.username}`);
      }
      break;

    case '/invisible':
      if (user.role !== 'admin') return socket.emit('error message', 'Commande réservée aux admins.');
      const param = args[1];
      const channel = userChannels[socket.id];
      if (param === 'on') {
        user.invisible = true;
        const u = roomUsers[channel]?.find(u => u.id === socket.id);
        if (u) u.invisible = true;
        socket.emit('server message', 'Mode invisible activé.');
        io.to(channel).emit('user list', roomUsers[channel].filter(u => !u.invisible));
      } else if (param === 'off') {
        user.invisible = false;
        const u = roomUsers[channel]?.find(u => u.id === socket.id);
        if (u) u.invisible = false;
        socket.emit('server message', 'Mode invisible désactivé.');
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} est maintenant visible.`,
          timestamp: new Date().toISOString(),
          channel
        });
      }
      break;

    default:
      socket.emit('error message', 'Commande inconnue.');
  }
}