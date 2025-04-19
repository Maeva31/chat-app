
const socket = io();

let currentChannel = "# 💬 ┊ Général";
let username = "";
let gender = "";
let age = "";
let role = "user";
const userList = document.getElementById("users");
const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("message-input");
const usernameSubmit = document.getElementById("username-submit");
const modal = document.getElementById("myModal");
const modalError = document.getElementById("modal-error");
const channelList = document.getElementById("channel-list");
const newChannelName = document.getElementById("new-channel-name");
const createChannelButton = document.getElementById("create-channel-button");

usernameSubmit.addEventListener("click", () => {
  const usernameInput = document.getElementById("username-input").value.trim();
  const genderSelect = document.getElementById("gender-select").value;
  const ageInput = parseInt(document.getElementById("age-input").value);

  if (!usernameInput || usernameInput.length > 16 || !genderSelect || isNaN(ageInput) || ageInput < 18 || ageInput > 89) {
    modalError.style.display = "block";
    modalError.textContent = "Veuillez remplir correctement tous les champs.";
    return;
  }

  username = usernameInput;
  gender = genderSelect;
  age = ageInput;
  modal.style.display = "none";

  socket.emit("new-user", { username, gender, age, role, channel: currentChannel });
});

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && messageInput.value.trim()) {
    socket.emit("chat-message", {
      channel: currentChannel,
      username,
      gender,
      age,
      role,
      message: messageInput.value.trim()
    });
    messageInput.value = "";
  }
});

createChannelButton.addEventListener("click", () => {
  const channelName = newChannelName.value.trim();
  if (channelName) {
    const formatted = `# ${channelName}`;
    socket.emit("create-channel", formatted);
    newChannelName.value = "";
  }
});

channelList.addEventListener("click", (e) => {
  if (e.target.classList.contains("channel")) {
    document.querySelectorAll(".channel").forEach(c => c.classList.remove("selected"));
    e.target.classList.add("selected");
    const newChannel = e.target.textContent;
    socket.emit("switch-channel", { oldChannel: currentChannel, newChannel });
    currentChannel = newChannel;
    chatMessages.innerHTML = "";
  }
});

socket.on("chat-message", (data) => {
  const msg = document.createElement("div");
  msg.innerHTML = `<strong>${data.username}</strong>: ${data.message}`;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on("user-list", (users) => {
  userList.innerHTML = "";
  users.forEach(user => {
    const li = document.createElement("li");
    li.innerHTML = `${user.username} <small>(${user.gender}, ${user.age})</small>`;
    userList.appendChild(li);
  });
});

socket.on("channel-created", (channelName) => {
  const li = document.createElement("li");
  li.className = "channel";
  li.textContent = channelName;
  channelList.appendChild(li);
});
