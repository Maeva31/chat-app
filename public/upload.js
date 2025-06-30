// Gestion du téléchargement de fichier
document.getElementById('file-input').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const username = getUsername();  // Implémenter cette fonction selon ton application
      if (username) {
        const fileType = file.type;  // Type MIME du fichier
        socket.emit('file upload', {
          username,
          file: e.target.result,
          fileName: file.name,
          fileType
        });
      }
    };
    reader.readAsDataURL(file);
  }
});

// Recevoir un fichier envoyé et l'afficher dans le chat
socket.on('file upload', function(data) {
  const chatMessages = document.getElementById("chat-messages");
  const newMessage = document.createElement("div");
  let fileContent = '';

  if (data.fileType.startsWith('image/')) {
    fileContent = `<strong>${data.username}:</strong> 
                   <a href="${data.file}" target="_blank">
                     <img src="${data.file}" alt="${data.fileName}" style="max-width:100px; max-height:100px; border-radius: 10px; cursor: pointer;">
                   </a>`;
  } else if (data.fileType.startsWith('video/')) {
    fileContent = `<strong>${data.username}:</strong> 
                   <video controls style="max-width:200px; max-height:200px; border-radius: 10px;">
                     <source src="${data.file}" type="${data.fileType}">
                     Votre navigateur ne supporte pas la lecture de vidéo.
                   </video>`;
  } else if (data.fileType.startsWith('audio/')) {
    fileContent = `<strong>${data.username}:</strong> 
                   <audio controls style="max-width:200px;">
                     <source src="${data.file}" type="${data.fileType}">
                     Votre navigateur ne supporte pas la lecture audio.
                   </audio>`;
  } else {
    fileContent = `<strong>${data.username}:</strong> 
                   <a href="${data.file}" download="${data.fileName}">Télécharger ${data.fileName}</a>`;
  }

  newMessage.innerHTML = fileContent;
  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});
