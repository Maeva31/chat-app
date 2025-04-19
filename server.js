const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let users = [];

io.on("connection", (socket) => {
    console.log("Un utilisateur est connecté");

    socket.on("chat-message", (message) => {
        io.emit("chat-message", message);
    });

    socket.on("disconnect", () => {
        console.log("Un utilisateur s'est déconnecté");
    });
});

server.listen(3000, () => {
    console.log("Serveur lancé sur http://localhost:3000");
});
