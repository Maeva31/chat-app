// roles.js
const roles = {
  admin: {
    name: 'Admin',
    color: 'red',  // Couleur rouge pour Admin
    permissions: ['kick', 'ban', 'mute', 'createRoom', 'deleteRoom']
  },
  modo: {
    name: 'Modérateur',
    color: 'green',  // Couleur verte pour Modérateur
    permissions: ['kick', 'ban', 'mute']
  },
  user: {
    name: 'Utilisateur',
    color: 'blue',  // Couleur bleue pour les utilisateurs
    permissions: ['chat']
  }
};

// Fonction pour récupérer un rôle par son nom
function getRole(roleName) {
  return roles[roleName] || roles.user;  // Retourne 'user' par défaut
}

// Fonction pour ajouter un rôle à un utilisateur
function assignRole(username, roleName) {
  if (roles[roleName]) {
    return { username, role: roles[roleName] };
  }
  return { username, role: roles.user };  // Par défaut assigner le rôle 'user'
}

export { roles, getRole, assignRole };
