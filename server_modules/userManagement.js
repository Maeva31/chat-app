import fs from 'fs';

export let users = {};           // { username: { id, username, gender, age, role, banned, muted, invisible } }
export let bannedUsers = new Set();
export let mutedUsers = new Set();

let modData = { admins: [], modos: [] };
let passwords = {};

export function loadModerators() {
  try {
    const data = fs.readFileSync('moderators.json', 'utf-8');
    modData = JSON.parse(data);
    console.log('✅ Modérateurs chargés');
  } catch (e) {
    console.warn("⚠️ Impossible de charger moderators.json");
  }

  try {
    const data = fs.readFileSync('passwords.json', 'utf-8');
    passwords = JSON.parse(data);
    console.log('✅ Mots de passe des modérateurs chargés');
  } catch (e) {
    console.warn("⚠️ Impossible de charger passwords.json");
  }
}

export function getUserRole(username) {
  if (modData.admins.includes(username)) return 'admin';
  if (modData.modos.includes(username)) return 'modo';
  return 'user';
}

export function requiresPassword(username) {
  const role = getUserRole(username);
  return (role === 'admin' || role === 'modo') && passwords[username];
}

export function validatePassword(username, password) {
  return passwords[username] && passwords[username] === password;
}

export function addUser(socket, { username, gender, age, role, invisible }) {
  users[username] = {
    id: socket.id,
    username,
    gender,
    age,
    role,
    banned: bannedUsers.has(username),
    muted: mutedUsers.has(username),
    invisible: !!invisible
  };
}

export function removeUser(socket) {
  const userEntry = Object.entries(users).find(([_, u]) => u.id === socket.id);
  if (!userEntry) return;
  const [username] = userEntry;
  delete users[username];
  bannedUsers.delete(username);
  mutedUsers.delete(username);
}
