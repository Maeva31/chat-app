const socket = io();

document.getElementById("send-button").addEventListener("click", () => {
    const message = document.getElementById("message-input").value;
    socket.emit("chat-message", message);
    document.getElementById("message-input").value = "";
});

document.querySelectorAll("#smiley-palette span").forEach(el => {
    el.addEventListener("click", () => {
        document.getElementById("message-input").value += el.textContent;
    });
});

socket.on("chat-message", (message) => {
    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    document.getElementById("chat-window").appendChild(messageElement);
});
