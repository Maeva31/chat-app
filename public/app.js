function getCurrentTimeString() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const wiizzSound = new Audio('/wizz.mp3');
const wiizzCooldowns = new Map();       // Pour éviter d'en envoyer trop souvent
const lastWiizzReceived = new Map();    // Pour éviter d'en recevoir trop souvent

// Réception d’un Wiizz
socket.on('private wiizz', ({ from }) => {
  const container = document.getElementById('private-chat-container');
  if (!container) return;

  const now = Date.now();
  const lastTime = lastWiizzReceived.get(from) || 0;
  if (now - lastTime < 5000) return;
  lastWiizzReceived.set(from, now);

  let win = container.querySelector(`.private-chat-window[data-user="${from}"]`);
  if (!win) {
    win = createPrivateChatWindow(from);
    container.appendChild(win);
  }

  triggerWiizzEffect(win);

  const body = win.querySelector('.private-chat-body');
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('wiizz-message', 'received');
  msgDiv.innerHTML = `
    <span style="color:orange;font-weight:bold;">
      <img src="/wizz.png" style="height:25px; width:44px; vertical-align:middle; margin-right:4px;">
      ${from} t’a envoyé un Wiizz ! <span style="font-size:11px;color:#888;">[${getCurrentTimeString()}]</span>
    </span>`;
  msgDiv.style.margin = '4px 0';
  body.appendChild(msgDiv);
  body.scrollTop = body.scrollHeight;
});

// Affiche une bannière temporaire de cooldown
function showCooldownBanner(username, win) {
  const existing = win.querySelector('.wiizz-cooldown-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.classList.add('wiizz-cooldown-banner');
  banner.textContent = `⏱️ Tu dois attendre 5 secondes avant de renvoyer un Wiizz à ${username}`;
  banner.style.backgroundColor = '#ffc107';
  banner.style.color = 'black';
  banner.style.fontWeight = 'bold';
  banner.style.padding = '6px';
  banner.style.textAlign = 'center';
  banner.style.borderBottom = '2px solid #222';
  banner.style.position = 'absolute';
  banner.style.top = '0';
  banner.style.left = '0';
  banner.style.width = '397px';
  banner.style.zIndex = '999';

  win.appendChild(banner);

  setTimeout(() => {
    if (banner.parentNode) banner.remove();
  }, 3000);
}

// Effet tremblement + son
function triggerWiizzEffect(win) {
  wiizzSound.currentTime = 0;
  wiizzSound.play().catch(err => console.warn('Impossible de jouer le son :', err));

  const originalStyle = win.style.transform;
  let count = 0;

  const interval = setInterval(() => {
    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 10;
    win.style.transform = `translate(${x}px, ${y}px)`;
    count++;
    if (count > 10) {
      clearInterval(interval);
      win.style.transform = originalStyle;
    }
  }, 50);
}

// Création du bouton Wiizz avec gestion complète du cooldown
function setupWiizzButton(username, win, container) {
  if (win.querySelector('.wiizz-button')) return null; // Empêche plusieurs boutons

  const wiizzBtn = document.createElement('button');
  wiizzBtn.classList.add('wiizz-button');
  wiizzBtn.title = 'Envoyer un Wiizz';
  wiizzBtn.style.background = 'transparent';
  wiizzBtn.style.border = 'none';
  wiizzBtn.style.cursor = 'pointer';
  wiizzBtn.style.marginRight = '5px';
  wiizzBtn.style.padding = '0';
  wiizzBtn.style.position = 'relative';
  wiizzBtn.style.width = '44px';
  wiizzBtn.style.height = '25px';

  const wiizzIcon = document.createElement('img');
  wiizzIcon.src = '/wizz.png';
  wiizzIcon.alt = 'Wiizz';
  wiizzIcon.style.width = '44px';
  wiizzIcon.style.height = '25px';
  wiizzIcon.style.verticalAlign = 'middle';
  wiizzBtn.appendChild(wiizzIcon);

  const cooldownOverlay = document.createElement('div');
  cooldownOverlay.style.position = 'absolute';
  cooldownOverlay.style.top = '0';
  cooldownOverlay.style.left = '0';
  cooldownOverlay.style.width = '100%';
  cooldownOverlay.style.height = '100%';
  cooldownOverlay.style.display = 'flex';
  cooldownOverlay.style.alignItems = 'center';
  cooldownOverlay.style.justifyContent = 'center';
  cooldownOverlay.style.background = 'rgba(0,0,0,0.5)';
  cooldownOverlay.style.color = 'white';
  cooldownOverlay.style.fontWeight = 'bold';
  cooldownOverlay.style.fontSize = '14px';
  cooldownOverlay.style.zIndex = '2';
  cooldownOverlay.style.pointerEvents = 'none'; // Permet de cliquer à travers si affiché

  wiizzBtn.appendChild(cooldownOverlay);
  cooldownOverlay.style.display = 'none'; // caché par défaut

  wiizzBtn.addEventListener('click', () => {
    const now = Date.now();
    const lastTime = wiizzCooldowns.get(username) || 0;
    const timeDiff = now - lastTime;

    if (timeDiff < 5000) {
      const winCheck = document.querySelector(`.private-chat-window[data-user="${username}"]`);
      if (winCheck) showCooldownBanner(username, winCheck);
      return;
    }

    wiizzCooldowns.set(username, now);
    socket.emit('private wiizz', { to: username });

    const winTarget = document.querySelector(`.private-chat-window[data-user="${username}"]`);
    if (winTarget) {
      triggerWiizzEffect(winTarget);

      const body = winTarget.querySelector('.private-chat-body');
      const msgDiv = document.createElement('div');
      msgDiv.classList.add('wiizz-message', 'sent');
      const myUsername = localStorage.getItem('username') || 'Vous';
      msgDiv.innerHTML = `
        <span style="color:orange;font-weight:bold;">
          <img src="/wizz.png" style="height:25px; width:44px; vertical-align:middle; margin-right:4px;">
          Vous avez envoyé un Wiizz à ${username} ! <span style="font-size:11px;color:#888;">[${getCurrentTimeString()}]</span>
        </span>`;
      msgDiv.style.margin = '4px 0';
      body.appendChild(msgDiv);
      body.scrollTop = body.scrollHeight;
    }

    // Activation du cooldown visuel
    wiizzBtn.disabled = true;
    cooldownOverlay.style.display = 'flex';

    let remaining = 5;
    cooldownOverlay.textContent = remaining;

    const countdown = setInterval(() => {
      remaining--;
      cooldownOverlay.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(countdown);
        cooldownOverlay.style.display = 'none';
        wiizzBtn.disabled = false;
      }
    }, 1000);
  });

  return wiizzBtn;
}

