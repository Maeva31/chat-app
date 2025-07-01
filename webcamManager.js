export default function setupWebcam(io) {
  io.on('connection', (socket) => {

    socket.on('join-webcam-room', (room) => {
      socket.join(room);
      // Notifier les autres qu'un nouvel utilisateur est prêt
      socket.to(room).emit('ready-for-call', { room, from: socket.id });
    });

    socket.on('leave-webcam-room', (room) => {
      socket.leave(room);
      // Notifier les autres que quelqu’un a quitté (optionnel)
    });

    socket.on('webrtc-offer', ({ offer, room, to }) => {
      // Reçoit une offre et transmet au destinataire spécifique
      io.to(to).emit('webrtc-offer', { offer, from: socket.id });
    });

    socket.on('webrtc-answer', ({ answer, room, to }) => {
      io.to(to).emit('webrtc-answer', { answer, from: socket.id });
    });

    socket.on('webrtc-ice-candidate', ({ candidate, room, to }) => {
      io.to(to).emit('webrtc-ice-candidate', { candidate, from: socket.id });
    });
  });
}
