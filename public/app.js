socket.on('user list', (list) => {
  // Suppression des connexions obsolètes
  Object.keys(peerConnections).forEach(username => {
    if (!list.find(u => u.username === username)) {
      if (peerConnections[username]) {
        peerConnections[username].close();
        delete peerConnections[username];
        const videoElem = document.getElementById(`remoteVideo-${username}`);
        if (videoElem && videoElem.parentNode) videoElem.parentNode.remove();
      }
    }
  });

  // Puis créer les nouvelles connexions (comme indiqué en 1)
  list.forEach(user => {
    if (user.username !== myUsername && !peerConnections[user.username]) {
      callUser(user.username);
    }
  });

  // Ton updateUserList ici aussi...
  updateUserList(list);
});






socket.on('webrtc offer', ({ to, offer }) => {
  const targetSocket = io.sockets.sockets.get(to);
  if (targetSocket) {
    targetSocket.emit('webrtc offer', { from: socket.id, offer });
  }
});

socket.on('webrtc answer', ({ to, answer }) => {
  const targetSocket = io.sockets.sockets.get(to);
  if (targetSocket) {
    targetSocket.emit('webrtc answer', { from: socket.id, answer });
  }
});

socket.on('webrtc ice candidate', ({ to, candidate }) => {
  const targetSocket = io.sockets.sockets.get(to);
  if (targetSocket) {
    targetSocket.emit('webrtc ice candidate', { from: socket.id, candidate });
  }
});








socket.on('signal', ({ to, from, data }) => {
  const targetSocket = io.sockets.sockets.get(to);
  if (targetSocket) {
    targetSocket.emit('signal', { from, data });
  }
});

