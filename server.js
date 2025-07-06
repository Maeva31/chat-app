// --- IMPORTS ---
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 20e6 // autorise jusqu’à 20 Mo par message
});

// --- DONNÉES ---
const MAX_HISTORY = 10;
const MAX_ROOMS = 50;

const users = {};
const userChannels = {};
const roomUsers = {};
const messageHistory = {};
let savedRooms = ['Général', 'Musique', 'Gaming'];
const mutedUsers = new Set();
const bannedUsers = new Set();

const passwords = JSON.parse(fs.readFileSync('./passwords.json'));

const modData = {
  modos: [],
  admins: []
};

const tempMods = {
  modos: new Set(),
  admins: new Set()
};

const localRoles = {};

// --- OUTILS ---
function emitUserList(channel) {
  const visibleUsers = (roomUsers[channel] || []).filter(u => !u.invisible);
  io.to(channel).emit('user list', visibleUsers);
}

function updateRoomUserCounts() {
  const counts = {};
  for (const [room, users] of Object.entries(roomUsers)) {
    counts[room] = users.filter(u => !u.invisible).length;
  }
  io.emit('room counts', counts);
}

function cleanupEmptyDynamicRooms() {
  for (const room of Object.keys(roomUsers)) {
    if (!savedRooms.includes(room) && roomUsers[room]?.length === 0) {
      delete roomUsers[room];
      delete messageHistory[room];
      delete localRoles[room];
    }
  }
}

function isLocalAdmin(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  return localRoles[room]?.admins?.has(user.username);
}

function isLocalModo(socket) {
  const user = Object.values(users).find(u => u.id === socket.id);
  const room = userChannels[socket.id];
  return localRoles[room]?.modos?.has(user.username);
}

function getLocalRole(username, room) {
  if (localRoles[room]?.admins?.has(username)) return 'admin';
  if (localRoles[room]?.modos?.has(username)) return 'modo';
  return null;
}

function getUserRole(username) {
  if (modData.admins.includes(username) || tempMods.admins.has(username)) return 'admin';
  if (modData.modos.includes(username) || tempMods.modos.has(username)) return 'modo';
  return 'user';
}

// --- SOCKET ---
io.on('connection', (socket) => {
  socket.on('chat message', (msg) => {
    const user = Object.values(users).find(u => u.id === socket.id);
    if (!user) return;

    const channel = userChannels[socket.id];
    if (!channel) return;

    if (msg.message.startsWith('/')) {
      const userRoom = channel;
      const isGlobalAdminOrModo = modData.admins.includes(user.username) || modData.modos.includes(user.username);

      const args = msg.message.trim().split(/\s+/);
      const cmd = args[0].toLowerCase();
      const targetName = args[1];
      const targetUser = Object.values(users).find(u => u.username === targetName);
      const targetUserRoom = targetUser ? userChannels[targetUser.id] : null;
      const now = Date.now();

      if (["/kick", "/ban", "/mute", "/unmute", "/addmodo", "/remove"].includes(cmd)) {
        if (!isGlobalAdminOrModo && !isLocalModo(socket)) {
          socket.emit("error message", "Vous n'avez pas les droits pour cette commande.");
          return;
        }

        if (!targetUser || !targetUserRoom) {
          socket.emit("error message", "Utilisateur introuvable.");
          return;
        }

        if (!isGlobalAdminOrModo && targetUserRoom !== userRoom) {
          socket.emit("error message", "Utilisateur introuvable dans ce salon.");
          return;
        }

        const isActingModo = getLocalRole(user.username, userRoom) === "modo";
        const isTargetAdminLocal = getLocalRole(targetName, userRoom) === "admin";
        if (!isGlobalAdminOrModo && isActingModo && isTargetAdminLocal) {
          socket.emit("error message", "Vous ne pouvez pas agir sur l'administrateur du salon.");
          return;
        }

        if (!localRoles[targetUserRoom]) {
          localRoles[targetUserRoom] = {
            admins: new Set(),
            modos: new Set(),
            kicks: new Map(),
            bans: new Map(),
            mutes: new Set()
          };
        }

        switch (cmd) {
          case '/kick':
            if (isGlobalAdminOrModo) {
              io.to(targetUser.id).emit('redirect', '/');
              setTimeout(() => io.sockets.sockets.get(targetUser.id)?.disconnect(), 500);
            } else {
              localRoles[targetUserRoom].kicks.set(targetName, now + 90 * 60 * 1000);
              io.to(targetUser.id).emit('redirect', '/');
              setTimeout(() => io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom), 500);
            }
            io.to(targetUserRoom).emit('server message', `${targetName} a été kické de ${targetUserRoom} par ${user.username}`);
            return;

          case '/ban':
            if (isGlobalAdminOrModo) {
              bannedUsers.add(targetName);
              io.to(targetUser.id).emit('redirect', 'https://banned.maevakonnect.fr');
              setTimeout(() => io.sockets.sockets.get(targetUser.id)?.disconnect(), 500);
            } else {
              localRoles[targetUserRoom].bans.set(targetName, now + 3 * 60 * 60 * 1000);
              io.to(targetUser.id).emit('redirect', '/');
              setTimeout(() => io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom), 500);
            }
            io.to(targetUserRoom).emit('server message', `${targetName} a été banni de ${targetUserRoom} par ${user.username}`);
            return;

          case '/mute':
            if (isGlobalAdminOrModo) {
              mutedUsers.add(targetName);
            } else {
              localRoles[targetUserRoom].mutes.add(targetName);
            }
            io.to(targetUserRoom).emit('server message', `${targetName} a été muté dans ${targetUserRoom}`);
            return;

          case '/unmute':
            if (isGlobalAdminOrModo) {
              mutedUsers.delete(targetName);
            } else {
              localRoles[targetUserRoom].mutes.delete(targetName);
            }
            io.to(targetUserRoom).emit('server message', `${targetName} n'est plus muté dans ${targetUserRoom}`);
            return;

          case '/addmodo':
            if (!(user.role === 'admin' || isLocalAdmin(socket))) {
              socket.emit('error message', "Seul l'admin local ou un admin global peut ajouter un modo.");
              return;
            }
            localRoles[targetUserRoom].modos.add(targetName);
            io.to(targetUserRoom).emit('server message', `${targetName} est maintenant modo local de ${targetUserRoom}`);
            return;

          case '/remove':
            io.sockets.sockets.get(targetUser.id)?.leave(targetUserRoom);
            io.to(targetUser.id).emit('removedFromRoom', targetUserRoom);
            io.to(targetUserRoom).emit('server message', `${targetName} a été retiré du salon ${targetUserRoom} par ${user.username}`);
            return;
        }
      }
    }

    const message = {
      username: user.username,
      gender: user.gender,
      role: user.role,
      message: msg.message || '',
      timestamp: msg.timestamp || new Date().toISOString(),
      channel,
      style: msg.style || {}
    };

    if (!messageHistory[channel]) messageHistory[channel] = [];
    messageHistory[channel].push(message);
    if (messageHistory[channel].length > MAX_HISTORY) {
      messageHistory[channel].shift();
    }

    io.to(channel).emit('chat message', message);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
