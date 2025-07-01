export function getUserRole(username, modData) {
  if (modData.admins.includes(username)) return 'admin';
  if (modData.modos.includes(username)) return 'modo';
  return 'user';
}

export function requiresPassword(username, passwords, modData) {
  const role = getUserRole(username, modData);
  return (role === 'admin' || role === 'modo') && passwords[username];
}