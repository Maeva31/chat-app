
const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, "public")));

const users = {};
const userChannels = {};
const messageHistory = {};
const defaultChannel = "# 💬 ┊ Général";

io.on("connection", (socket) => {
  socket.on("new-user", (data) => {
    users[socket.id] = { ...data };
    userChannels[socket.id] = data.channel || defaultChannel;
    if (!messageHistory[userChannels[socket.id]]) {
      messageHistory[userChannels[socket.id]] = [];
    }
    socket.join(userChannels[socket.id]);
    io.to(userChannels[socket.id]).emit("user-list", getUsersInChannel(userChannels[socket.id]));
  });

  socket.on("chat-message", (data) => {
    const channel = userChannels[socket.id];
    const messageData = {
      username: data.username,
      message: data.message,
      gender: data.gender,
      age: data.age,
      role: data.role,
    };
    messageHistory[channel].push(messageData);
    io.to(channel).emit("chat-message", messageData);
  });

  socket.on("create-channel", (channelName) => {
    if (!messageHistory[channelName]) {
      messageHistory[channelName] = [];
      io.emit("channel-created", channelName);
    }
  });

  socket.on("switch-channel", ({ oldChannel, newChannel }) => {
    socket.leave(oldChannel);
    socket.join(newChannel);
    userChannels[socket.id] = newChannel;
    io.to(newChannel).emit("user-list", getUsersInChannel(newChannel));
  });

  socket.on("disconnect", () => {
    const channel = userChannels[socket.id];
    delete users[socket.id];
    delete userChannels[socket.id];
    io.to(channel).emit("user-list", getUsersInChannel(channel));
  });
});

function getUsersInChannel(channel) {
  return Object.keys(users)
    .filter((id) => userChannels[id] === channel)
    .map((id) => users[id]);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur lancé sur http://localhost:${PORT}`));
