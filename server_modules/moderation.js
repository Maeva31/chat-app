import { bannedUsers, mutedUsers, users } from './userManagement.js';
import { roomUsers, emitUserList, updateRoomUserCounts } from './roomManagement.js';

export function handleCommand(io, socket, msg, userChannels) {
  const user = Object.values(users).find(u => u.id === socket.id);
  if (!user) return;

  const defaultChannel = 'Général';
  const channel = userChannels[socket.id] || defaultChannel;

  if (!msg.message.startsWith('/')) return;

  if (user.role !== 'admin' && user.role !== 'modo') {
    socket.emit('no permission');
    return;
  }

  const args = msg.message.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const targetName = args[1];
  const targetUser = Object.values(users).find(u => u.username === targetName);

  const isTargetProtected = targetUser && (targetUser.role === 'admin' || targetUser.role === 'modo');
  const isUserModo = user.role === 'modo';

  switch (cmd) {
    case '/ban':
      if (!targetUser) {
        socket.emit('error message', 'Utilisateur introuvable.');
        return;
      }
      if (isUserModo && isTargetProtected) {
        socket.emit('error message', 'Vous ne pouvez pas bannir cet utilisateur.');
        return;
      }
      bannedUsers.add(targetName);
      io.to(targetUser.id).emit('banned');
      io.to(targetUser.id).emit('redirect', 'https://banned.maevakonnect.fr');
      setTimeout(() => {
        io.sockets.sockets.get(targetUser.id)?.disconnect(true);
      }, 1500);
      io.emit('server message', `${targetName} a été banni par ${user.username}`);
      console.log(`⚠️ ${user.username} a banni ${targetName}`);
      return;

    case '/kick':
      if (!targetUser) {
        socket.emit('error message', 'Utilisateur introuvable.');
        return;
      }
      if (isUserModo && isTargetProtected) {
        socket.emit('error message', 'Vous ne pouvez pas expulser cet utilisateur.');
        return;
      }
      io.to(targetUser.id).emit('kicked');
      io.to(targetUser.id).emit('redirect', 'https://maevakonnect.fr');
      setTimeout(() => {
        io.sockets.sockets.get(targetUser.id)?.disconnect(true);
      }, 1500);
      io.emit('server message', `${targetName} a été expulsé par ${user.username}`);
      console.log(`⚠️ ${user.username} a expulsé ${targetName}`);
      return;

    case '/mute':
      if (!targetUser) {
        socket.emit('error message', 'Utilisateur introuvable.');
        return;
      }
      if (isUserModo && isTargetProtected) {
        socket.emit('error message', 'Vous ne pouvez pas muter cet utilisateur.');
        return;
      }
      mutedUsers.add(targetName);
      io.to(targetUser.id).emit('muted');
      io.emit('server message', `${targetName} a été muté par ${user.username}`);
      console.log(`⚠️ ${user.username} a muté ${targetName}`);
      return;

    case '/unmute':
      if (!targetUser) {
        socket.emit('error message', 'Utilisateur introuvable.');
        return;
      }
      if (mutedUsers.has(targetName)) {
        mutedUsers.delete(targetName);
        io.to(targetUser.id).emit('unmuted');
        io.emit('server message', `${targetName} a été unmuté par ${user.username}`);
        console.log(`⚠️ ${user.username} a unmuté ${targetName}`);
      } else {
        socket.emit('error message', `${targetName} n'est pas muté.`);
      }
      return;

    case '/unban':
      if (!targetUser) {
        socket.emit('error message', 'Utilisateur introuvable.');
        return;
      }
      if (bannedUsers.has(targetName)) {
        bannedUsers.delete(targetName);
        io.emit('server message', `${targetName} a été débanni par ${user.username}`);
        console.log(`⚠️ ${user.username} a débanni ${targetName}`);
      } else {
        socket.emit('error message', `${targetName} n'est pas banni.`);
      }
      return;

    case '/invisible':
      if (user.role !== 'admin') {
        socket.emit('error message', 'Commande /invisible réservée aux administrateurs.');
        return;
      }
      if (args.length < 2) {
        socket.emit('error message', 'Usage : /invisible on | off');
        return;
      }
      const param = args[1].toLowerCase();
      if (param === 'on') {
        user.invisible = true;
        if (roomUsers[channel]) {
          const u = roomUsers[channel].find(u => u.id === socket.id);
          if (u) u.invisible = true;
        }
        socket.emit('server message', 'Mode invisible activé.');
        console.log(`🔍 ${user.username} a activé le mode invisible.`);
        emitUserList(io, channel);
        updateRoomUserCounts(io);
      } else if (param === 'off') {
        user.invisible = false;
        if (roomUsers[channel]) {
          const u = roomUsers[channel].find(u => u.id === socket.id);
          if (u) u.invisible = false;
        }
        socket.emit('server message', 'Mode invisible désactivé.');
        console.log(`🔍 ${user.username} a désactivé le mode invisible.`);
        emitUserList(io, channel);
        updateRoomUserCounts(io);
        io.to(channel).emit('chat message', {
          username: 'Système',
          message: `${user.username} est maintenant visible.`,
          timestamp: new Date().toISOString(),
          channel
        });
      } else {
        socket.emit('error message', 'Paramètre invalide. Usage : /invisible on | off');
      }
      return;

    default:
      socket.emit('error message', 'Commande inconnue.');
      return;
  }
}
