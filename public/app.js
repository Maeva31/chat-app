// --- Upload fichier (fusionné depuis upload.js) ---
const uploadInput = document.getElementById('file-input');    // correspond à l'input file
const uploadButton = document.getElementById('upload-btn');   // correspond au bouton

if (uploadInput && uploadButton) {
  uploadButton.addEventListener('click', () => {
    uploadInput.click();
  });

  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const arrayBuffer = reader.result;
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      socket.emit('upload file', {
        filename: file.name,
        mimetype: file.type,
        data: base64,
        channel: currentChannel,
        timestamp: new Date().toISOString()
      });
    };

    reader.readAsArrayBuffer(file);
  });
}


// Affichage d’un fichier uploadé

socket.on('file uploaded', ({ username, filename, data, mimetype, timestamp }) => {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('message');
  wrapper.innerHTML = `[${new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] <strong>${username}</strong>: `;

  if (mimetype.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = `data:${mimetype};base64,${data}`;
    img.alt = filename;
    img.style.maxWidth = '200px';
    img.style.maxHeight = '200px';
    img.style.border = '1px solid #333';
    img.style.marginTop = '4px';
    wrapper.appendChild(img);
  } else {
    const link = document.createElement('a');
    link.href = `data:${mimetype};base64,${data}`;
    link.download = filename;
    link.textContent = `📎 ${filename}`;
    link.target = '_blank';
    wrapper.appendChild(link);
  }

  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});



});
