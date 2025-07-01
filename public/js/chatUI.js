const genderColors = {
  Homme: '#00f',
  Femme: '#f0f',
  Autre: '#0ff',
  'non spécifié': '#aaa',
  default: '#aaa'
};

export function getUsernameColor(gender) {
  return genderColors[gender] || genderColors.default;
}

let bannerTimeoutId = null;
let initialLoadComplete = false;

export function showBanner(message, type = 'error') {
  if (!initialLoadComplete) return;
  const banner = document.getElementById('error-banner');
  const text = document.getElementById('error-banner-text');
  if (!banner || !text) return;
  const prefix = type === 'success' ? '✅' : '❌';
  text.textContent = `${prefix} ${message}`;
  banner.style.display = 'flex';
  banner.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
  if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
  bannerTimeoutId = setTimeout(() => {
    banner.style.display = 'none';
    bannerTimeoutId = null;
  }, 5000);
}

export function addMessageToChat(msg) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  const newMessage = document.createElement('div');
  const date = new Date(msg.timestamp);
  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const usernameSpan = document.createElement('span');
  usernameSpan.textContent = msg.username;
  usernameSpan.style.color = getUsernameColor(msg.gender);
  newMessage.innerHTML = `[${timeString}] `;
  newMessage.appendChild(usernameSpan);
  newMessage.append(`: ${msg.message}`);
  newMessage.classList.add('message');
  newMessage.dataset.username = msg.username;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function updateUserList(users) {
  const userList = document.getElementById('users');
  if (!userList) return;
  userList.innerHTML = '';
  users.forEach(user => {
    const li = document.createElement('li');
    li.textContent = `${user.username} (${user.age})`;
    userList.appendChild(li);
  });
}
