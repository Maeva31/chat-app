// Fonction pour récupérer le pseudo actuel
function getUsername() {
  return window.currentUsername || localStorage.getItem('username') || 'Inconnu';
}

// Ouvre le sélecteur de fichier quand on clique sur 📎
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

// Gestion du téléchargement de fichier
document.getElementById('file-input').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const username = getUsername();
      if (username) {
        socket.emit('file upload', {
          username,
          file: e.target.result,
          fileName: file.name,
          fileType: file.type
        });
      }
    };
    reader.readAsDataURL(file);
  }
});

// Recevoir un fichier envoyé et l'afficher dans le chat
socket.on('file upload', function(data) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const newMessage = document.createElement("div");
  newMessage.classList.add("message");

  let icon = '';
  let preview = '';

  if (data.fileType.startsWith('image/')) {
    icon = '📷';
    preview = `<a href="${data.file}" target="_blank" rel="noopener noreferrer">
                 <img src="${data.file}" alt="${data.fileName}" style="max-width:100px; max-height:100px; border-radius: 10px; cursor: pointer;">
               </a>`;
  } else if (data.fileType.startsWith('video/')) {
    icon = '🎞️';
    preview = `<video controls style="max-width:200px; max-height:200px; border-radius: 10px;">
                 <source src="${data.file}" type="${data.fileType}">
                 Votre navigateur ne supporte pas la lecture de vidéo.
               </video>`;
  } else if (data.fileType.startsWith('audio/')) {
    icon = '🎵';
    preview = `<audio controls style="max-width:200px;">
                 <source src="${data.file}" type="${data.fileType}">
                 Votre navigateur ne supporte pas la lecture audio.
               </audio>`;
  } else {
    icon = '📄';
    preview = `<a href="${data.file}" download="${data.fileName}">${data.fileName}</a>`;
  }

  newMessage.innerHTML = `<strong>${data.username}:</strong> ${icon} ${preview}`;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
// Fonction pour récupérer le pseudo actuel
function getUsername() {
  return window.currentUsername || localStorage.getItem('username') || 'Inconnu';
}

// Ouvre le sélecteur de fichier quand on clique sur 📎
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

// Gestion du téléchargement de fichier
document.getElementById('file-input').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const username = getUsername();
      if (username) {
        socket.emit('file upload', {
          username,
          file: e.target.result,
          fileName: file.name,
          fileType: file.type
        });
      }
    };
    reader.readAsDataURL(file);
  }
});

// Recevoir un fichier envoyé et l'afficher dans le chat
socket.on('file upload', function(data) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  const newMessage = document.createElement("div");
  newMessage.classList.add("message");

  let icon = '';
  let preview = '';

  if (data.fileType.startsWith('image/')) {
    icon = '📷';
    preview = `<a href="${data.file}" target="_blank" rel="noopener noreferrer">
                 <img src="${data.file}" alt="${data.fileName}" style="max-width:100px; max-height:100px; border-radius: 10px; cursor: pointer;">
               </a>`;
  } else if (data.fileType.startsWith('video/')) {
    icon = '🎞️';
    preview = `<video controls style="max-width:200px; max-height:200px; border-radius: 10px;">
                 <source src="${data.file}" type="${data.fileType}">
                 Votre navigateur ne supporte pas la lecture de vidéo.
               </video>`;
  } else if (data.fileType.startsWith('audio/')) {
    icon = '🎵';
    preview = `<audio controls style="max-width:200px;">
                 <source src="${data.file}" type="${data.fileType}">
                 Votre navigateur ne supporte pas la lecture audio.
               </audio>`;
  } else {
    icon = '📄';
    preview = `<a href="${data.file}" download="${data.fileName}">${data.fileName}</a>`;
  }

  newMessage.innerHTML = `<strong>${data.username}:</strong> ${icon} ${preview}`;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
