// public/webrtc.js
const peers = {};
let localStream = null;

async function initMicrophone() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
}

function callPeer(socket, targetId) {
  const peer = new RTCPeerConnection();

  // Ajoute notre micro
  localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

  peer.onicecandidate = e => {
    if (e.candidate) {
      socket.emit('webrtc:ice-candidate', { target: targetId, candidate: e.candidate });
    }
  };

  peer.ontrack = e => {
    const audio = document.createElement('audio');
    audio.srcObject = e.streams[0];
    audio.autoplay = true;
    document.body.appendChild(audio);
  };

  peer.createOffer().then(sdp => {
    peer.setLocalDescription(sdp);
    socket.emit('webrtc:offer', { target: targetId, sdp });
  });

  peers[targetId] = peer;
}

function handleSignaling(socket) {
  socket.on('webrtc:offer', async ({ caller, sdp }) => {
    const peer = new RTCPeerConnection();

    localStream.getTracks().forEach(track => peer.addTrack(track, localStream));

    peer.onicecandidate = e => {
      if (e.candidate) {
        socket.emit('webrtc:ice-candidate', { target: caller, candidate: e.candidate });
      }
    };

    peer.ontrack = e => {
      const audio = document.createElement('audio');
      audio.srcObject = e.streams[0];
      audio.autoplay = true;
      document.body.appendChild(audio);
    };

    await peer.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit('webrtc:answer', { target: caller, sdp: peer.localDescription });
    peers[caller] = peer;
  });

  socket.on('webrtc:answer', async ({ sdp, callee }) => {
    await peers[callee]?.setRemoteDescription(new RTCSessionDescription(sdp));
  });

  socket.on('webrtc:ice-candidate', async ({ sender, candidate }) => {
    await peers[sender]?.addIceCandidate(new RTCIceCandidate(candidate));
  });
}
