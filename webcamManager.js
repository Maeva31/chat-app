// webcamManager.js
export default function setupWebcam(io) {
  io.on('connection', (socket) => {

    // Exemple : événement signaling pour WebRTC (offer, answer, candidate)
    socket.on('webcam-offer', (data) => {
      const { targetId, offer } = data;
      io.to(targetId).emit('webcam-offer', { from: socket.id, offer });
    });

    socket.on('webcam-answer', (data) => {
      const { targetId, answer } = data;
      io.to(targetId).emit('webcam-answer', { from: socket.id, answer });
    });

    socket.on('webcam-candidate', (data) => {
      const { targetId, candidate } = data;
      io.to(targetId).emit('webcam-candidate', { from: socket.id, candidate });
    });

    socket.on('webcam-stop', () => {
      // Notifier les autres que ce socket arrête sa webcam
      socket.broadcast.emit('webcam-stopped', socket.id);
    });

    // Tu peux gérer ici d'autres événements liés aux webcams.
  });
}
