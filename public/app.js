const socket = io();

let users = [];
let userCache = {};
let currentRoom = 'Général'; 
let bannedRooms = [];
let roomOwners = {};
let roomModerators = {};
let topZIndex = 1000;



function updateAllPrivateChatsStyle(style) {
  const container = document.getElementById('private-chat-container');
  if (!container) return;

  // Mise à jour des inputs dans les fenêtres privées
  container.querySelectorAll('.private-chat-window').forEach(win => {
    if (win._inputField) {
      applyStyleToInputField(win._inputField, style);
    }

    // Mise à jour des messages textes dans la fenêtre privée
    const messages = win.querySelectorAll('.private-message .message-text');
    messages.forEach(msgSpan => {
      msgSpan.style.color = style.color || '#fff';
      msgSpan.style.fontWeight = style.bold ? 'bold' : 'normal';
      msgSpan.style.fontStyle = style.italic ? 'italic' : 'normal';
      msgSpan.style.fontFamily = style.font || 'Arial';
    });
  });
}

function applyStyleToInputField(input, style) {
  input.style.color = style.color || '#fff';
  input.style.fontWeight = style.bold ? 'bold' : 'normal';
  input.style.fontStyle = style.italic ? 'italic' : 'normal';
  input.style.fontFamily = style.font || 'Arial';
}


document.addEventListener('DOMContentLoaded', () => {

function updateAllInputStyles() {
  const container = document.getElementById('private-chat-container');
  if (!container) return;

  container.querySelectorAll('.private-chat-window').forEach(win => {
    if (win._inputField) {
      applyStyleToInput(win._inputField, currentStyle);
    }
  });
}

const newChannelInput = document.getElementById('new-channel-name');

if (newChannelInput) {
  newChannelInput.addEventListener('input', () => {
    // Supprimer les espaces en direct
    newChannelInput.value = newChannelInput.value.replace(/\s/g, '');

    // Limiter à 10 caractères max
    if (newChannelInput.value.length > 10) {
      newChannelInput.value = newChannelInput.value.slice(0, 10);
    }
  });
}

 applyStyleToInput(newChannelInput, currentStyle);



   // ── 1) Stockage et mise à jour de la liste users ──

  socket.on('user list', list => {
    users = list;
    userCache = {};
    list.forEach(u => {
      userCache[u.username] = u;
    });
    updateUserList(list);

    // Mise à jour couleurs fenêtres privées
    const container = document.getElementById('private-chat-container');
    if (container) {
      container.querySelectorAll('.private-chat-window').forEach(win => {
        const username = win.dataset.user;
        const user = userCache[username];
        const title = win.querySelector('.private-chat-header span.username-text');
        if (user && title) {
          title.style.color = (user.role === 'admin') ? usernameColors.admin
                            : (user.role === 'modo') ? usernameColors.modo
                            : (usernameColors[user.gender] || usernameColors.default);
        }
      });
    }
  });

  // ── 2) Couleurs selon rôle/genre ──
  const usernameColors = {
    admin: 'red',
    modo: 'limegreen',
    Homme: 'dodgerblue',
    Femme: '#f0f',
    Trans: '#EE82EE',
    'non spécifié': '#aaa',
    default: '#aaa'
  };

  // Création icône selon rôle
// Création icône selon rôle
function createRoleIcon(role) {
  if (role === 'admin') {
    const icon = document.createElement('img');
    icon.src = '/diamond.ico';
    icon.alt = 'Admin';
    icon.title = 'Admin';
    icon.style.width = '20px';
    icon.style.height = '17px';
    icon.style.marginRight = '3px';
    icon.style.verticalAlign = 'middle';
    return icon;
  } else if (role === 'modo') {
    const icon = document.createElement('img');
    icon.src = '/favicon.ico';
    icon.alt = 'Modérateur';
    icon.title = 'Modérateur';
    icon.style.width = '20px';
    icon.style.height = '20px';
    icon.style.marginRight = '3px';
    icon.style.verticalAlign = 'middle';
    return icon;
  }
  return null;
}

// Création icône selon genre
function createGenderIcon(gender) {
  const icon = document.createElement('img');
  icon.style.width = '16px';
  icon.style.height = '16px';
  icon.style.marginRight = '3px';
  icon.style.verticalAlign = 'middle';

  if (gender === 'Homme') {
    icon.src = '/male.ico';
    icon.alt = 'Homme';
    icon.title = 'Homme';
  } else if (gender === 'Femme') {
    icon.src = '/female.ico';
    icon.alt = 'Femme';
    icon.title = 'Femme';
  } else if (gender === 'Trans') {
    icon.src = '/trans.ico';
    icon.alt = 'Trans';
    icon.title = 'Trans';
  } else {
    return null;
  }

  return icon;
}


  // ── 3) Ouvre ou remonte une fenêtre privée ──
function openPrivateChat(username, role, gender) {
  const container = document.getElementById('private-chat-container');
  let win = container.querySelector(`.private-chat-window[data-user="${username}"]`);

  // ✅ Si la fenêtre existe déjà → la ramener au premier plan
  if (win) {
    win.style.zIndex = ++topZIndex;
    return;
  }

  
  // ✅ Récupération des infos utilisateur si manquantes
let age; 

if (!role || !gender || !age) {
  const cachedUser = userCache[username];
  if (cachedUser) {
    role = role || cachedUser.role;
    gender = gender || cachedUser.gender;
    age = cachedUser.age;
  }
}


  // ✅ Création de la fenêtre
  win = document.createElement('div');
  win.classList.add('private-chat-window');
  win.dataset.user = username;

  win.style.position = 'absolute';      // nécessaire pour le z-index
  win.style.zIndex = ++topZIndex;

  // ✅ Au clic, remonter au premier plan
  win.addEventListener('mousedown', () => {
    win.style.zIndex = ++topZIndex;
  });
  

  // ── Header ──
const header = document.createElement('div');
header.classList.add('private-chat-header');

// Crée le bloc de titre avec icônes
const title = document.createElement('span');
title.classList.add('username-text');
title.style.display = 'flex';
title.style.alignItems = 'center';
title.style.gap = '5px';

title.style.color = (role === 'admin') ? usernameColors.admin
                  : (role === 'modo') ? usernameColors.modo
                  : (usernameColors[gender] || usernameColors.default);

// Ajout des icônes
const roleIcon = createRoleIcon(role);

// Détection si protégé
const isProtected = role === 'admin' || role === 'modo' ||
  roomOwners[currentRoom] === username ||
  (roomModerators[currentRoom] && roomModerators[currentRoom].has(username));

const genderIcon = !isProtected ? createGenderIcon(gender) : null;

if (roleIcon) title.appendChild(roleIcon);
if (genderIcon) title.appendChild(genderIcon);

// ⬛ Ajout du carré d’âge avec couleur selon genre
if (age) {
  const ageBox = document.createElement('span');
  ageBox.textContent = age;
  ageBox.style.backgroundColor = usernameColors[gender] || '#444';
  ageBox.style.color = '#fff';
  ageBox.style.borderRadius = '4px';
  ageBox.style.padding = '2px 6px';
  ageBox.style.fontSize = '12px';
  ageBox.style.fontWeight = 'bold';
  ageBox.style.fontFamily = 'monospace';
  ageBox.style.marginRight = '2px';
  title.appendChild(ageBox);
}


// Ajout du pseudo
title.appendChild(document.createTextNode(username));



// ✅ Groupe pour les deux boutons à droite
const buttonGroup = document.createElement('div');
buttonGroup.style.marginLeft = 'auto';
buttonGroup.style.display = 'flex';
buttonGroup.style.alignItems = 'center';
buttonGroup.style.gap = '6px';

// Crée bouton Réduire
const minimizeBtn = document.createElement('button');
minimizeBtn.textContent = '🗕';
minimizeBtn.title = 'Réduire';

// Crée bouton Fermer
const closeBtn = document.createElement('button');
closeBtn.textContent = '×';
closeBtn.title = 'Fermer';

// Appliquer un style uniforme à chaque bouton
[minimizeBtn, closeBtn].forEach(btn => {
  btn.style.background = 'transparent';
  btn.style.border = 'none';
  btn.style.padding = '2px';
  btn.style.margin = '0';
  btn.style.fontSize = '16px';
  btn.style.width = '26px';
  btn.style.height = '26px';
  btn.style.lineHeight = '1';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '4px';
  btn.style.transition = 'background 0.2s';

  // Hover visuel
  btn.onmouseenter = () => btn.style.backgroundColor = '#444';
  btn.onmouseleave = () => btn.style.backgroundColor = 'transparent';
});

// Action Réduire / Restaurer
minimizeBtn.onclick = () => {
  const minimized = win.classList.toggle('minimized');
  minimizeBtn.textContent = minimized ? '🗖' : '🗕';
  minimizeBtn.title = minimized ? 'Restaurer' : 'Réduire';
};

// Action Fermer
closeBtn.onclick = () => container.removeChild(win);

// Ajoute les deux boutons au groupe
buttonGroup.append(minimizeBtn, closeBtn);

header.style.display = 'flex';
header.style.alignItems = 'center';
header.style.justifyContent = 'space-between';


// Ajoute le groupe de boutons et le titre au header
header.append(title, buttonGroup);






  // Header à la fenêtre
  win.appendChild(header);

  // Fenêtre au conteneur
  container.appendChild(win);


    // Body
    const body = document.createElement('div');
    body.classList.add('private-chat-body');

    // Barre d'input
    const inputBar = document.createElement('div');
    inputBar.classList.add('private-chat-input');
    inputBar.style.position = 'relative';
    inputBar.style.backgroundColor = '#121212';   // fond sombre
    inputBar.style.padding = '6px';
    inputBar.style.borderRadius = '8px';
    inputBar.style.display = 'flex';
    inputBar.style.alignItems = 'center';

    const input = document.createElement('input');
    input.placeholder = 'Message…';
    input.style.backgroundColor = '#333';  // fond sombre pour l’input
    input.style.color = '#fff';             // texte clair
    input.style.border = '1px solid #555';
    input.style.borderRadius = '4px';
    input.style.flexGrow = '1';             // pour que l’input prenne tout l’espace horizontal
    input.style.padding = '6px 8px';
    input.style.outline = 'none';
    win._inputField = input; // garde la référence
    applyStyleToInput(input, currentStyle); // applique le style initial
    if (currentStyle) {
    if (currentStyle.color) input.style.color = currentStyle.color;
    input.style.fontWeight = currentStyle.bold ? 'bold' : 'normal';
    input.style.fontStyle = currentStyle.italic ? 'italic' : 'normal';
    input.style.fontFamily = currentStyle.font || 'Arial';
  }



    // Boutons emoji & upload
    const emojiBtn = document.createElement('button');
    emojiBtn.textContent = '😊';
    emojiBtn.title = 'Insérer un émoji';
    emojiBtn.style.fontSize = '20px';
    emojiBtn.style.background = 'transparent';
    emojiBtn.style.border = 'none';
    emojiBtn.style.cursor = 'pointer';
    emojiBtn.style.marginRight = '5px';

    const emojiPicker = document.createElement('div');
    emojiPicker.classList.add('emoji-picker');
    emojiPicker.style.display = 'none';
    emojiPicker.style.position = 'absolute';
    emojiPicker.style.bottom = '40px';
    emojiPicker.style.left = '0';
    emojiPicker.style.background = '#222';
    emojiPicker.style.padding = '8px';
    emojiPicker.style.borderRadius = '8px';
    emojiPicker.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    emojiPicker.style.zIndex = '1000';
    emojiPicker.style.maxWidth = '200px';
    emojiPicker.style.flexWrap = 'wrap';

    const emojis = ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶'];
    emojis.forEach(e => {
      const span = document.createElement('span');
      span.textContent = e;
      span.style.cursor = 'pointer';
      span.style.fontSize = '22px';
      span.style.margin = '4px';
      span.addEventListener('click', () => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        input.value = input.value.slice(0, start) + e + input.value.slice(end);
        input.selectionStart = input.selectionEnd = start + e.length;
        input.focus();
        emojiPicker.style.display = 'none';
      });
      emojiPicker.appendChild(span);
    });

    emojiBtn.addEventListener('click', e => {
      e.stopPropagation();
      emojiPicker.style.display = (emojiPicker.style.display === 'none') ? 'flex' : 'none';
    });

    document.addEventListener('click', () => {
      emojiPicker.style.display = 'none';
    });

    emojiPicker.addEventListener('click', e => e.stopPropagation());

    // Initialisation son unique en haut du script
        // WIZZZ
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
      ${from} t’a envoyé un Wiizz ! <span style="font-size:11px; color:#888; font-style:italic;">${getCurrentTimeString()}</span>
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
wiizzIcon.style.position = 'relative';
wiizzIcon.style.top = '2px';  // ou -2px, -6px selon l'ajustement visuel voulu
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
          Vous avez envoyé un Wiizz à ${username} ! <span style="font-size:11px; color:#888; font-style:italic;">${getCurrentTimeString()}</span>
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




    // Upload fichier
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '📁';
    uploadBtn.title = 'Envoyer un fichier';
    uploadBtn.style.fontSize = '20px';
    uploadBtn.style.background = 'transparent';
    uploadBtn.style.border = 'none';
    uploadBtn.style.cursor = 'pointer';
    uploadBtn.style.marginRight = '5px';

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      const MAX_SIZE = 50 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert('Le fichier est trop volumineux (max 50 Mo)');
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const arrayBuffer = reader.result;
        const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        socket.emit('upload private file', {
          to: username,
          filename: file.name,
          mimetype: file.type,
          data: base64,
          timestamp: new Date().toISOString()
        });

        // Affichage local
        const myUsername = localStorage.getItem('username') || 'moi';
        let win = container.querySelector(`.private-chat-window[data-user="${username}"]`);
        if (!win) {
          openPrivateChat(username);
          win = container.querySelector(`.private-chat-window[data-user="${username}"]`);
          if (!win) return;
        }
        const body = win.querySelector('.private-chat-body');

        const me = userCache[myUsername] || { role: 'user', gender: 'non spécifié' };
        const color = (me.role === 'admin') ? usernameColors.admin
                   : (me.role === 'modo') ? usernameColors.modo
                   : (usernameColors[me.gender] || usernameColors.default);

        const msgDiv = document.createElement('div');
        msgDiv.style.margin = '4px 0';

        const who = document.createElement('span');
        who.style.fontWeight = 'bold';
        who.style.marginRight = '4px';
        who.style.display = 'inline-flex';
        who.style.alignItems = 'center';

        const icon = createRoleIcon(me.role);
        if (icon) who.appendChild(icon);

        who.appendChild(document.createTextNode(myUsername + ': '));
        who.style.color = color;

        msgDiv.appendChild(who);

        if (file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = `data:${file.type};base64,${base64}`;
          img.style.maxWidth = '150px';
          img.style.cursor = 'pointer';
          img.style.border = '2px solid #007bff';
          img.style.borderRadius = '8px';
          img.style.padding = '4px';
          img.addEventListener('click', () => {
            const newWin = window.open();
            if (newWin) {
              newWin.document.write(`
                <html><head><title>${file.name}</title></head>
                <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#000;">
                <img src="${img.src}" alt="${file.name}" style="max-width:100vw;max-height:100vh;" />
                </body></html>
              `);
              newWin.document.close();
            }
          });
          msgDiv.appendChild(img);

        } else if (file.type.startsWith('audio/')) {
          const audio = document.createElement('audio');
          audio.controls = true;
          audio.src = `data:${file.type};base64,${base64}`;
          audio.style.marginTop = '4px';
          audio.style.border = '2px solid #007bff';
          audio.style.borderRadius = '8px';
          audio.style.padding = '4px';
          audio.style.backgroundColor = '#212529';
          msgDiv.appendChild(audio);
            const darkMode = true; // ou détecte selon préférence

          if (darkMode) {
            audio.style.backgroundColor = '#212529';
            audio.style.border = '2px solid #007bff';
            audio.style.color = '#fff';
          } else {
            audio.style.backgroundColor = '#f5f5f5';
            audio.style.border = '2px solid #007bff';
            audio.style.color = '#000';
          }


        } else if (file.type.startsWith('video/')) {
          const video = document.createElement('video');
          video.controls = true;
          video.src = `data:${file.type};base64,${base64}`;
          video.style.maxWidth = '300px';
          video.style.maxHeight = '300px';
          video.style.marginTop = '4px';
          video.style.border = '2px solid #007bff';
          video.style.borderRadius = '8px';
          video.style.padding = '4px';
          video.style.backgroundColor = '#000';
          msgDiv.appendChild(video);

        } else {
          const link = document.createElement('a');
          link.href = `data:${file.type};base64,${base64}`;
          link.download = file.name;
          link.textContent = `📎 ${file.name}`;
          link.target = '_blank';
          msgDiv.appendChild(link);
        }

        body.appendChild(msgDiv);
        body.scrollTop = body.scrollHeight;

        fileInput.value = '';
      };

      reader.readAsArrayBuffer(file);
    });

    // Bouton envoyer
    const sendBtn = document.createElement('button');
sendBtn.textContent = '➤';
sendBtn.title = 'Envoyer le message';

Object.assign(sendBtn.style, {
  cursor: 'pointer',
  marginLeft: '5px',
  padding: '0',
  width: '36px',
  height: '36px',
  borderRadius: '50%',
  fontSize: '14px',
  fontWeight: 'bold',
  border: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});


    // Assemblage inputBar : emoji avant upload
    const wiizzBtn = setupWiizzButton(username, win, container);
inputBar.append(emojiBtn, wiizzBtn, uploadBtn, emojiPicker, fileInput, input, sendBtn);



    sendBtn.onclick = () => {
  const text = input.value.trim();
  if (!text) return;

  socket.emit('private message', { 
    to: username, 
    message: text,
    style: currentStyle  // <-- envoie le style avec le message
  });

  const myUsername = localStorage.getItem('username') || 'moi';
  appendPrivateMessage(body, myUsername, text, null, null, currentStyle);  // <-- applique localement aussi

  input.value = '';
  };


    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') sendBtn.click();
    });

    // Assemblage fenêtre
    win.append(header, body, inputBar);

    // Position initiale et drag & drop
    win.style.position = 'absolute';
    win.style.bottom = '20px';
    win.style.right = '20px';

    let isDragging = false, offsetX = 0, offsetY = 0;
    header.style.cursor = 'move';

    header.addEventListener('mousedown', e => {
      isDragging = true;
      offsetX = e.clientX - win.offsetLeft;
      offsetY = e.clientY - win.offsetTop;
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const newLeft = e.clientX - offsetX;
      const newTop = e.clientY - offsetY;
      const maxLeft = window.innerWidth - win.offsetWidth;
      const maxTop = window.innerHeight - win.offsetHeight;
      win.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
      win.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
      win.style.bottom = 'auto';
      win.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
      }
    });

    container.appendChild(win);
  }

  window.openPrivateChat = openPrivateChat;

  // ── 4) Ajoute un message dans la fenêtre privée ──
function appendPrivateMessage(bodyElem, from, text, role, gender, style = null) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'private-message';

  let userRole = role;
  let userGender = gender;

  if (!userRole || !userGender) {
    const cachedUser = userCache[from];
    if (cachedUser) {
      userRole = userRole || cachedUser.role;
      userGender = userGender || cachedUser.gender;
    }
  }

  // Pseudo
  const who = document.createElement('span');
  who.className = 'username';
  who.style.color = userRole === 'admin' ? usernameColors.admin
                : userRole === 'modo' ? usernameColors.modo
                : (usernameColors[userGender] || usernameColors.default);

  const icon = createRoleIcon(userRole);
  if (icon) who.appendChild(icon);

  who.appendChild(document.createTextNode(from + ':'));

  // Message texte
  const textSpan = document.createElement('span');
  textSpan.className = 'message-text';
  textSpan.textContent = text;

  // **Appliquer style perso s’il est fourni**
  if (style) {
  textSpan.style.color = style.color || '#fff';
  textSpan.style.fontWeight = style.bold ? 'bold' : 'normal';
  textSpan.style.fontStyle = style.italic ? 'italic' : 'normal';
  textSpan.style.fontFamily = style.font || 'Arial';
} else {
  // Appliquer le style global courant
  textSpan.style.color = currentStyle.color || '#fff';
  textSpan.style.fontWeight = currentStyle.bold ? 'bold' : 'normal';
  textSpan.style.fontStyle = currentStyle.italic ? 'italic' : 'normal';
  textSpan.style.fontFamily = currentStyle.font || 'Arial';
}


  // Horodatage
  const timeSpan = document.createElement('span');
  timeSpan.className = 'timestamp';
  const now = new Date();
  timeSpan.textContent = ` ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  // Ajout à la ligne
  msgDiv.append(who, textSpan, timeSpan);
  bodyElem.appendChild(msgDiv);
  bodyElem.scrollTop = bodyElem.scrollHeight;
}



  // ── 5) Clic pseudo ouvre la fenêtre privée ──
  document.addEventListener('click', e => {
    const span = e.target.closest('.clickable-username');
    if (!span) return;
    const username = span.textContent.trim();
    const userObj = userCache[username];
    if (!userObj) return;
    openPrivateChat(username, userObj.role, userObj.gender);
  });

  // ── 6) Réception message privé ──
  socket.on('private message', ({ from, message, role, gender, style }) => {
  const myUsername = localStorage.getItem('username');
  if (from === myUsername) return;

  const container = document.getElementById('private-chat-container');
  let win = container.querySelector(`.private-chat-window[data-user="${from}"]`);

  if (!win) {
    const userObj = userCache[from] || {};
    openPrivateChat(from, userObj.role, userObj.gender);
    win = container.querySelector(`.private-chat-window[data-user="${from}"]`);
  }
  if (!win) return;

  const body = win.querySelector('.private-chat-body');

  // Appliquer style reçu, sinon null (donc style par défaut)
  appendPrivateMessage(body, from, message, role, gender, style || null);
});


  // ── 7) Réception fichier privé ──
  socket.on('private file', ({ from, filename, data, mimetype, timestamp, role, gender }) => {
    const myUsername = localStorage.getItem('username');
    if (from === myUsername) return;
    const container = document.getElementById('private-chat-container');
    if (!container) return;

    let win = container.querySelector(`.private-chat-window[data-user="${from}"]`);
    if (!win) {
      const userObj = userCache[from] || {};
      openPrivateChat(from, userObj.role, userObj.gender);
      win = container.querySelector(`.private-chat-window[data-user="${from}"]`);
      if (!win) return;
    }

    const body = win.querySelector('.private-chat-body');

    const msgDiv = document.createElement('div');
    msgDiv.style.margin = '4px 0';

    const who = document.createElement('span');
    who.style.fontWeight = 'bold';
    who.style.marginRight = '4px';
    who.style.display = 'inline-flex';
    who.style.alignItems = 'center';

    let userRole = role;
    let userGender = gender;
    if (!userRole || !userGender) {
      const cachedUser = userCache[from];
      if (cachedUser) {
        userRole = userRole || cachedUser.role;
        userGender = userGender || cachedUser.gender;
      }
    }

    const icon = createRoleIcon(userRole);
    if (icon) who.appendChild(icon);

    who.appendChild(document.createTextNode(from + ': '));
    who.style.color = userRole === 'admin' ? usernameColors.admin
                 : userRole === 'modo' ? usernameColors.modo
                 : (usernameColors[userGender] || usernameColors.default);

    msgDiv.appendChild(who);

    // Affichage fichier
    if (mimetype.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = `data:${mimetype};base64,${data}`;
      img.style.maxWidth = '150px';
      img.style.cursor = 'pointer';
      img.style.border = '2px solid #007bff';
      img.style.borderRadius = '8px';
      img.style.padding = '4px';
      img.addEventListener('click', () => {
        const newWin = window.open();
        if (newWin) {
          newWin.document.write(`
            <html><head><title>${filename}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#000;">
            <img src="${img.src}" alt="${filename}" style="max-width:100vw;max-height:100vh;" />
            </body></html>
          `);
          newWin.document.close();
        } else {
          alert('Impossible d’ouvrir un nouvel onglet. Vérifie le bloqueur de popups.');
        }
      });
      msgDiv.appendChild(img);

    } else if (mimetype.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = `data:${mimetype};base64,${data}`;
      audio.style.marginTop = '4px';
      audio.style.border = '2px solid #007bff';
      audio.style.borderRadius = '8px';
      audio.style.padding = '4px';
      audio.style.backgroundColor = '#212529';
      msgDiv.appendChild(audio);

        const darkMode = true;

      if (darkMode) {
        audio.style.backgroundColor = '#212529';
        audio.style.border = '2px solid #007bff';
        audio.style.color = '#fff';
      } else {
        audio.style.backgroundColor = '#343a40';
        audio.style.border = '2px solid #007bff';
        audio.style.color = '#000';
      }


    } else if (mimetype.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = `data:${mimetype};base64,${data}`;
      video.style.maxWidth = '300px';
      video.style.maxHeight = '300px';
      video.style.marginTop = '4px';
      video.style.border = '2px solid #007bff';
      video.style.borderRadius = '8px';
      video.style.padding = '4px';
      msgDiv.appendChild(video);

    } else {
      const link = document.createElement('a');
      link.href = `data:${mimetype};base64,${data}`;
      link.download = filename;
      link.textContent = `📎 ${filename}`;
      link.target = '_blank';
      link.style.display = 'inline-block';
      link.style.marginTop = '4px';
      msgDiv.appendChild(link);
    }

    body.appendChild(msgDiv);
    body.scrollTop = body.scrollHeight;
  });
});




// Message système dans le chat avec l'heure
let bannerLocked = false;

// Affichage messages système dans le chat
socket.on('server message', msg => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const chatContainer = document.querySelector('.chat-messages');
  if (!chatContainer) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';

  const text = typeof msg === 'string' ? msg : (msg.text || JSON.stringify(msg));

  messageDiv.innerHTML = `<span class="time" style="font-style: italic; color: grey;">${time}</span> ${text}`;

  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

// Gestion de la bannière d’erreur
socket.on('error message', msg => {
  const banner = document.getElementById('error-banner');
  const bannerText = document.getElementById('error-banner-text');
  if (!banner || !bannerText) return;

  bannerText.textContent = msg;
  banner.style.display = 'block';

  // Ne pas cacher automatiquement si banni d’un salon
  if (!msg.includes("banni du salon")) {
    setTimeout(() => {
      banner.style.display = 'none';
    }, 4000);
  }
});


// Fonction appelée quand on change de salon
function hideErrorBannerOnRoomChange(roomName) {
  const banner = document.getElementById('error-banner');
  if (banner) banner.style.display = 'none';
  bannerLocked = false;

  // Affiche dans le chat qu’on a changé de salon
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.innerHTML = `<span class="time" style="font-style: italic; color: grey;">${time}</span> Vous avez rejoint le salon #${roomName}`;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

socket.on('kicked from room', room => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.innerHTML = `<span class="time" style="font-style: italic; color: grey;">${time}</span> Vous avez été expulsé du salon #${room}`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Bannières persistantes
  const banner = document.getElementById('error-banner');
  const bannerText = document.getElementById('error-banner-text');
  if (banner && bannerText) {
    bannerText.textContent = `Tu as été expulsé du salon ${room}`;
    banner.style.display = 'block';
    bannerLocked = true;
  }
});

socket.on('banned from room', room => {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.innerHTML = `<span class="time" style="font-style: italic; color: grey;">${time}</span> Vous avez été banni du salon #${room}`;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Bannières persistantes
  const banner = document.getElementById('error-banner');
  const bannerText = document.getElementById('error-banner-text');
  if (banner && bannerText) {
    bannerText.textContent = `Tu as été banni du salon ${room}`;
    banner.style.display = 'block';
    bannerLocked = true;
  }
});

socket.on('redirect to room', roomName => {
  const roomElement = Array.from(document.querySelectorAll('.channel'))
    .find(el => el.textContent.toLowerCase().includes(roomName.toLowerCase()));
  
  if (roomElement) {
    roomElement.click(); // ✅ Simule un clic pour changer visuellement de salon
  }
  

  // Optionnel : notifier dans le chat
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'system-message';
    msgDiv.innerHTML = `<span class="time" style="font-style: italic; color: grey;">${time}</span> Vous avez été redirigé vers #${roomName}`;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
});

document.querySelectorAll('.channel').forEach(channelEl => {
  channelEl.addEventListener('click', () => {
    const channelName = channelEl.textContent.trim().replace(/^#/, '').split('┊')[1].trim();

    // Demande de rejoindre le salon
    socket.emit('join room', channelName);
  });
});
socket.on('error message', msg => {
  const banner = document.getElementById('error-banner');
  const bannerText = document.getElementById('error-banner-text');

  if (!banner || !bannerText) return;

  bannerText.textContent = msg;
  banner.style.display = 'block';

  // Si l'utilisateur est banni, ne pas laisser le salon s'ouvrir
  if (msg.toLowerCase().includes("tu as été banni du salon")) {
  const match = msg.match(/tu as été banni du salon (.+?)\./i);
  const bannedRoom = match ? match[1] : null;

  if (bannedRoom) {
    // Annule l'affichage du salon interdit
    document.querySelectorAll('.channel').forEach(c => c.classList.remove('selected'));

    // Récupère ton salon actuel et redirige
    if (currentRoom) {
      const currentEl = Array.from(document.querySelectorAll('.channel'))
        .find(el => el.textContent.toLowerCase().includes(currentRoom.toLowerCase()));
      if (currentEl) currentEl.click(); // ✅ Retour visuel au bon salon
    }

    // Et affiche une bannière si ce n'est pas déjà le cas
    const banner = document.getElementById('error-banner');
    const bannerText = document.getElementById('error-banner-text');
    if (banner && bannerText) {
      bannerText.textContent = `Tu es banni du salon ${bannedRoom}`;
      banner.style.display = 'block';
    }
  }
}


  // Affiche la bannière pendant 4s (ou laisse ouverte selon ton besoin)
  setTimeout(() => {
    banner.style.display = 'none';
  }, 4000);
});
socket.on('room joined', roomName => {
  currentRoom = roomName;

  // Met à jour l’UI (titre, messages, liste d’utilisateurs, etc.)
  document.querySelectorAll('.channel').forEach(c => {
    const text = c.textContent.toLowerCase();
    if (text.includes(roomName.toLowerCase())) c.classList.add('selected');
    else c.classList.remove('selected');
  });

  // Efface l'ancien chat
  const chatContainer = document.querySelector('.chat-messages');
  if (chatContainer) chatContainer.innerHTML = '';

  // Demande historique si tu l'as
  socket.emit('request history', roomName);
});

socket.on('force leave room', (roomName) => {
  if (currentRoom === roomName) {
    // Empêche affichage visuel du salon interdit
    alert(`Tu es banni du salon ${roomName}. Redirection...`);
    socket.emit('joinRoom', 'Général');
  }
});


socket.on('error message', msg => {
  if (msg.startsWith('Tu es banni du salon')) {
    // alert(msg); ✅ Supprimé, plus d'alerte

    // Extraire le nom du salon
    const match = msg.match(/Tu es banni du salon (.+?) /);
    const bannedRoom = match ? match[1] : null;

    if (bannedRoom) {
      const roomElement = document.querySelector(`.room-item[data-room="${bannedRoom}"]`);
      if (roomElement) {
        roomElement.classList.add('room-banned');
        roomElement.style.opacity = '0.4';
        roomElement.style.pointerEvents = 'none';
        roomElement.title = "Vous êtes banni de ce salon";
      }
    }
  }
});

socket.on('banned rooms list', rooms => {
  bannedRooms = rooms || [];
  updateRoomButtons(); // appelle ta fonction qui construit les boutons
});













 const adminUsernames = ['MaEvA','rookie'];
 const modoUsernames = ['DarkGirL'];


  let selectedUser = null;
  let hasSentUserInfo = false;
  let initialLoadComplete = false;
  let bannerTimeoutId = null;

  let currentChannel = 'Général';  // Forcer le salon Général au chargement

const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');


if (usernameInput && passwordInput) {
  usernameInput.addEventListener('input', () => {
  const val = usernameInput.value.trim(); // ❌ retirer .toLowerCase()
  if (adminUsernames.includes(val) || modoUsernames.includes(val)) {
    passwordInput.style.display = 'block'; // afficher le mot de passe
  } else {
    passwordInput.style.display = 'none';  // cacher sinon
    passwordInput.value = '';              // vider le mot de passe
  }
});

 const initialUsername = usernameInput.value.trim();
  if (adminUsernames.includes(initialUsername) || modoUsernames.includes(initialUsername)) {
    passwordInput.style.display = 'block';
  }
}


  const genderColors = {
    Homme: 'dodgerblue',
    Femme: '#f0f',
    Trans: '#EE82EE',
    'non spécifié': '#aaa',
    default: '#aaa'
  };

  const channelEmojis = {
    "Général": "💬",
    "Musique": "🎧",
    "Gaming": "🎮",
    "Détente": "🌿",
    "Lesbiennes": "♀️",
    "GayGay": "♂️",
    "TransGirl": "⚧️",
    "Paris": "💬",
    "Reims": "💬",
    "Lyon": "💬",
    "Marseille": "💬",
    "Nice": "💬",
    "Toulouse": "💬",
    "Sexe": "🔞"

  };

  // Affiche la modal si pas de pseudo
  const savedUsername = localStorage.getItem('username');
  if (!savedUsername) {
    document.getElementById('myModal').style.display = 'block';
  }

  // Variables pour mode invisible
  const invisibleBtn = document.getElementById('toggle-invisible-btn');
  let invisibleMode = localStorage.getItem('invisibleMode') === 'true' || false;
  let isAdmin = false;

  // Mets à jour le bouton (texte + couleur)
  function updateInvisibleButton() {
    if (!invisibleBtn) return;
    invisibleBtn.textContent = `👻`;
    invisibleBtn.style.backgroundColor = invisibleMode ? '#4CAF50' : '#f44336';
    invisibleBtn.title = invisibleMode ? 'Mode Invisible activé' : 'Mode Invisible désactivé';

  }

  if (invisibleBtn) {
    if (invisibleMode) {
      invisibleBtn.style.display = 'inline-block';
      updateInvisibleButton();
    } else {
      invisibleBtn.style.display = 'none';
    }
  }

  // Affiche une bannière temporaire (type = 'error' ou 'success')
  function showBanner(message, type = 'error') {
    if (!initialLoadComplete) return;
    const banner = document.getElementById('error-banner');
    const text = document.getElementById('error-banner-text');
    if (!banner || !text) return;

    const prefix = type === 'success' ? '✅' : '❌';
    text.textContent = `${prefix} ${message}`;
    banner.style.display = 'flex';
    banner.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';

    if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
    bannerTimeoutId = setTimeout(() => {
      banner.style.display = 'none';
      bannerTimeoutId = null;
    }, 5000);
  }

  // Couleur selon genre
  function getUsernameColor(gender) {
    return genderColors[gender] || genderColors.default;
  }

  // Extraction nom canal depuis texte (ex: "# 💬 ┊ Général (2)" => "Général")
  function extractChannelName(text) {
    text = text.replace(/\s*\(\d+\)$/, '').trim();
    const parts = text.split('┊');
    if (parts.length > 1) return parts[1].trim();
    return text.replace(/^#?\s*[\p{L}\p{N}\p{S}\p{P}\s]*/u, '').trim();
  }

  // ⚠️ Assure-toi que tu as bien roomOwner et roomModerators définis !
if (typeof roomOwner !== 'undefined' && roomModerators instanceof Set) {
  users.forEach(u => {
    u.isRoomOwner = (u.username === roomOwner);
    u.isRoomModo = roomModerators.has(u.username);
  });
}


  // Met à jour la liste des utilisateurs affichée
function updateUserList(users) {
  const userList = document.getElementById('users');
  if (!userList || !Array.isArray(users)) return;
  userList.innerHTML = '';

  users.forEach(user => {
    const username = user?.username || 'Inconnu';
    const age = user?.age || '?';
    const gender = user?.gender || 'non spécifié';
    const role = user?.role || 'user';
    const isRoomOwner = user?.isRoomOwner === true;
    const isRoomModo = user?.isRoomModo === true;

    const li = document.createElement('li');
    li.classList.add('user-item');

    let color = getUsernameColor(gender);
    if (role === 'admin') color = 'red';
    else if (role === 'modo') color = 'limegreen';
    if (isRoomOwner) color = '#a020f0'; // violet
    else if (isRoomModo) color = '#cc66ff'; // mauve

    const badgeWrapper = document.createElement('div');
    badgeWrapper.classList.add('badge-wrapper');

    // 🎖 Icône
    const icon = document.createElement('img');
    let showIcon = false;

    if (isRoomOwner || role === 'admin') {
      icon.src = '/diamond.ico';
      icon.alt = 'Créateur';
      icon.title = 'Créateur du salon';
      showIcon = true;
    } else if (isRoomModo || role === 'modo') {
      icon.src = '/favicon.ico';
      icon.alt = 'Modérateur';
      icon.title = 'Modérateur';
      showIcon = true;
    } else {
      if (gender === 'Homme') {
        icon.src = '/male.ico';
        icon.alt = 'Homme';
        icon.title = 'Homme';
        showIcon = true;
      } else if (gender === 'Femme') {
        icon.src = '/female.ico';
        icon.alt = 'Femme';
        icon.title = 'Femme';
        showIcon = true;
      } else if (gender === 'Trans') {
        icon.src = '/trans.ico';
        icon.alt = 'Trans';
        icon.title = 'Trans';
        showIcon = true;
      }
    }

    if (showIcon) {
      Object.assign(icon.style, {
        width: '18px',
        height: '18px',
        marginRight: '3px',
        verticalAlign: '-1px'
      });
      badgeWrapper.appendChild(icon);
    }

    // 🎯 Âge
    const genderSquare = document.createElement('div');
    genderSquare.classList.add('gender-square');
    genderSquare.style.backgroundColor = getUsernameColor(gender);
    genderSquare.textContent = age;
    badgeWrapper.appendChild(genderSquare);

    genderSquare.addEventListener('click', (e) => {
      e.preventDefault();
      const targetUser = username;

      const myUsername = localStorage.getItem('username');
      const currentRoom = localStorage.getItem('currentRoom');
      const me = userCache[myUsername];

      const isAdmin = me?.role === 'admin';
      const isModo = me?.role === 'modo';
      const isGlobalMod = isAdmin || isModo;
      const isRoomOwner = roomOwners?.[currentRoom] === myUsername;
      const isRoomModo = roomModerators?.[currentRoom]?.has(myUsername);

      const canShowMenu = isGlobalMod || isRoomOwner || isRoomModo;
      if (!canShowMenu) return;

      const rect = genderSquare.getBoundingClientRect();
      const x = rect.left + window.scrollX;
      const y = rect.bottom + window.scrollY;
      showModerationMenu(targetUser, x, y);
    });

    // 🧑‍💻 Pseudo
    const usernameSpan = document.createElement('span');
    usernameSpan.classList.add('username-span', 'clickable-username');
    if (username === localStorage.getItem('username') && role === 'admin' && localStorage.getItem('password')) {
    usernameSpan.classList.add('rainbow-admin');
}
    usernameSpan.textContent = username;
    usernameSpan.style.color = color;

    if (role === 'admin') usernameSpan.title = 'Admin';
    else if (role === 'modo') usernameSpan.title = 'Modérateur';
    else if (isRoomOwner) usernameSpan.title = 'Créateur du salon';
    else if (isRoomModo) usernameSpan.title = 'Modérateur du salon';

// 🖱️ Clic gauche → ouvrir MP
usernameSpan.addEventListener('click', () => {
  openPrivateChat(username, role, gender);
});

// 🖱️ Clic droit → mentionner
usernameSpan.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const mention = `@${username} `;
  if (!input.value.includes(mention)) input.value = mention + input.value;
  input.focus();
});


    li.append(badgeWrapper, usernameSpan);
    userList.appendChild(li);
  });
}





function createRoleIcon(role) {
  if (role === 'admin') {
    const icon = document.createElement('img');
    icon.src = '/diamond.ico'; // icône admin
    icon.alt = 'Admin';
    icon.title = 'Admin';
    icon.classList.add('admin-icon');
    return icon;
  } else if (role === 'modo') {
    const icon = document.createElement('img');
    icon.src = '/favicon.ico'; // icône modo
    icon.alt = 'Modérateur';
    icon.title = 'Modérateur';
    icon.classList.add('modo-icon');
    return icon;
  }
  return null;
}


 const logoutButton = document.getElementById('logoutButton');

const logoutModal = document.getElementById('logoutModal');
const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
const logoutCancelBtn = document.getElementById('logoutCancelBtn');

function openLogoutModal() {
  if (logoutModal) {
    logoutModal.style.display = 'flex';
  }
}

function closeLogoutModal() {
  if (logoutModal) {
    logoutModal.style.display = 'none';
  }
}

function performLogout() {
  socket.emit('logout');
  ['username', 'gender', 'age', 'password', 'invisibleMode', 'currentChannel'].forEach(key => {
    localStorage.removeItem(key);
  });
  location.reload();
}

if (logoutButton) {
  logoutButton.addEventListener('click', openLogoutModal);
}

if (logoutConfirmBtn) {
  logoutConfirmBtn.addEventListener('click', () => {
    closeLogoutModal();
    performLogout();
  });
}

if (logoutCancelBtn) {
  logoutCancelBtn.addEventListener('click', closeLogoutModal);
}

// Pour fermer la modal si clic en dehors de la boîte blanche
if (logoutModal) {
  logoutModal.addEventListener('click', e => {
    if (e.target === logoutModal) {
      closeLogoutModal();
    }
  });
}

// Extrait l'ID vidéo YouTube depuis une URL et retourne l'URL de la miniature
function getYouTubeThumbnail(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  if (match) {
    return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}


// Ajoute une miniature YouTube au message s'il contient un ou plusieurs liens YouTube
function addYouTubeVideoIfAny(messageElement, messageText) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = messageText.match(urlRegex);
  if (!urls) return;

  urls.forEach(url => {
    const videoId = getYouTubeVideoId(url);
    if (videoId) {
      const wrapper = document.createElement('div');
      wrapper.classList.add('youtube-wrapper');

      const iframe = document.createElement('iframe');
      // Supprimer largeur/hauteur fixes pour laisser le CSS gérer
      // iframe.width = '480';
      // iframe.height = '270';
      iframe.src = `https://www.youtube.com/embed/${videoId}?controls=1`;
      iframe.frameBorder = '0';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;

      wrapper.appendChild(iframe);
      messageElement.appendChild(wrapper);
    }
  });
}






// Fonction utilitaire pour extraire l’ID vidéo YouTube d’une URL
function getYouTubeVideoId(url) {
  const regExp = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}



  // Ajoute un message dans la zone de chat
function addMessageToChat(msg) {
  if (msg.username === 'Système') {
    // Ignore le message "est maintenant visible."
    if (/est maintenant visible\.$/i.test(msg.message)) return;

    const salonRegex = /salon\s+(.+)$/i;
    const match = salonRegex.exec(msg.message);
    if (match && match[1]) {
      const salonDuMessage = match[1].trim();
      if (salonDuMessage !== currentChannel) return;
    }
  }

  const chatMessages = document.getElementById('chat-messages');
if (!chatMessages) return;

const newMessage = document.createElement('div');
const date = new Date(msg.timestamp);
const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const usernameSpan = document.createElement('span');
const color = (msg.role === 'admin') ? 'red' :
              (msg.role === 'modo') ? 'limegreen' :
              getUsernameColor(msg.gender);

if (msg.username === 'Système') {
  usernameSpan.textContent = msg.username + ': ';
  usernameSpan.style.color = '#888';
  usernameSpan.style.fontWeight = 'bold';
} else {
  usernameSpan.classList.add('clickable-username');
  usernameSpan.style.color = color;
  usernameSpan.textContent = msg.username + ': ';
  usernameSpan.title = (msg.role === 'admin') ? 'Admin' :
                       (msg.role === 'modo') ? 'Modérateur' : '';




    // Icônes selon rôle
    if (msg.role === 'admin') {
      const icon = document.createElement('img');
      icon.src = '/diamond.ico';
      icon.alt = 'Admin';
      icon.title = 'Admin';
      icon.style.width = '17px';
      icon.style.height = '15px';
      icon.style.marginRight = '2px';
      icon.style.verticalAlign = '-1px';
      usernameSpan.insertBefore(icon, usernameSpan.firstChild);
    } else if (msg.role === 'modo') {
      const icon = document.createElement('img');
      icon.src = '/favicon.ico';
      icon.alt = 'Modérateur';
      icon.title = 'Modérateur';
      icon.style.width = '16px';
      icon.style.height = '16px';
      icon.style.marginRight = '1px';
      icon.style.verticalAlign = '-2px';
      usernameSpan.insertBefore(icon, usernameSpan.firstChild);
    }

    // Clic pour mentionner
// 🖱️ Clic gauche → mentionner dans l'input
usernameSpan.addEventListener('click', () => {
  const input = document.getElementById('message-input');
  const mention = `@${msg.username} `;
  if (!input.value.includes(mention)) input.value = mention + input.value;
  input.focus();
});

// 🖱️ Clic droit → ouvrir messagerie privée
usernameSpan.addEventListener('contextmenu', (e) => {
  e.preventDefault(); // empêche le menu contextuel natif
  if (typeof openPrivateChat === 'function') {
    openPrivateChat(msg.username, msg.role, msg.gender);
  } else {
    console.warn('❌ openPrivateChat() non défini');
  }
});
}


  function isYouTubeUrl(url) {
    return /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))/.test(url);
  }

  const parts = msg.message.split(/(https?:\/\/[^\s]+)/g);

  const messageText = document.createElement('span');
  const style = msg.style || {};
  messageText.style.color = style.color || '#fff';
  messageText.style.fontWeight = style.bold ? 'bold' : 'normal';
  messageText.style.fontStyle = style.italic ? 'italic' : 'normal';
  messageText.style.fontFamily = style.font || 'Arial';

  parts.forEach(part => {
    if (/https?:\/\/[^\s]+/.test(part)) {
      if (isYouTubeUrl(part)) {
        return; // ignore dans texte, vidéo intégrée ailleurs
      } else {
        const a = document.createElement('a');
        a.href = part;
        a.textContent = part;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.style.color = style.color || '#00aaff';
        a.style.textDecoration = 'underline';
        messageText.appendChild(a);
      }
    } else {
      if (part.trim() !== '') {
        messageText.appendChild(document.createTextNode(part));
      }
    }
  });

  // --- Ici la modification principale : ajout du span timeSpan ---
  const timeSpan = document.createElement('span');
  timeSpan.textContent = timeString + ' ';
  timeSpan.style.color = '#888';
  timeSpan.style.fontStyle = 'italic';
  timeSpan.style.marginRight = '5px';

  newMessage.appendChild(timeSpan);

  if (msg.username !== 'Système') {
    newMessage.appendChild(usernameSpan);
  }

  // Ajouter ":" + espace après le pseudo uniquement si message non vide
  if (msg.username === 'Système') {
    messageText.style.color = '#888';
    messageText.style.fontStyle = 'italic';

    newMessage.appendChild(messageText);
  } else if (messageText.textContent.trim() !== '') {
    newMessage.appendChild(messageText);
  }

  newMessage.classList.add('message');
  newMessage.dataset.username = msg.username;

  addYouTubeVideoIfAny(newMessage, msg.message);

  chatMessages.appendChild(newMessage);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

  // Sélectionne visuellement un salon dans la liste
  function selectChannelInUI(channelName) {
    document.querySelectorAll('.channel').forEach(c => {
      if (extractChannelName(c.textContent) === channelName) {
        c.classList.add('selected');
      } else {
        c.classList.remove('selected');
      }
    });
  }

  // Quand on rejoint un salon côté serveur
  socket.on('joinedRoom', (newChannel) => {
    currentChannel = newChannel;
    localStorage.setItem('currentChannel', newChannel);
    const chatMessages = document.getElementById('chat-messages');
    const input = document.getElementById('message-input');
    if (input) input.value = '';

    if (chatMessages) chatMessages.innerHTML = '';
    selectChannelInUI(newChannel);
    selectedUser = null;
    socket.emit('request history', newChannel);
  });

  // Clic sur un salon dans la liste
  document.getElementById('channel-list').addEventListener('click', (e) => {
    const target = e.target.closest('.channel');
    if (!target) return;
    const clickedChannel = extractChannelName(target.textContent);
    if (!clickedChannel || clickedChannel === currentChannel) return;

    currentChannel = clickedChannel;
    localStorage.setItem('currentChannel', currentChannel);
    socket.emit('joinRoom', currentChannel);
    const chatMessages = document.getElementById('chat-messages');
    const input = document.getElementById('message-input');
    if (input) input.value = '';

    if (chatMessages) chatMessages.innerHTML = '';
    selectChannelInUI(currentChannel);
    selectedUser = null;
  });

  // Envoi message
  function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    const message = input.value.trim();
    const username = localStorage.getItem('username');
    if (!message) return showBanner("Vous ne pouvez pas envoyer de message vide.", 'error');
    if (message.length > 300) return showBanner("Message trop long (300 caractères max).", 'error');

    if (username) {
      socket.emit('chat message', {
        message,
        timestamp: new Date().toISOString(),
        style: loadSavedStyle() 
      });
      input.value = '';
    }
  }


function submitUserInfo() {
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input'); // récupère le mot de passe
  const genderSelect = document.getElementById('gender-select');
  const ageInput = document.getElementById('age-input');
  const modalError = document.getElementById('modal-error');

  if (!usernameInput || !genderSelect || !ageInput || !modalError || !passwordInput) return;

  const username = usernameInput.value.trim();
  const gender = genderSelect.value;
  const age = parseInt(ageInput.value.trim(), 10);
  const password = passwordInput.value.trim();

  if (!username || username.includes(' ') || username.length > 16) {
    modalError.textContent = "Le pseudo ne doit pas contenir d'espaces et doit faire 16 caractères max.";
    modalError.style.display = 'block';
    return;
  }
  if (isNaN(age) || age < 18 || age > 89) {
    modalError.textContent = "L'âge doit être un nombre entre 18 et 89.";
    modalError.style.display = 'block';
    return;
  }
  if (!gender) {
    modalError.textContent = "Veuillez sélectionner un genre.";
    modalError.style.display = 'block';
    return;
  }

 if ((adminUsernames.includes(username) || modoUsernames.includes(username)) && password.length === 0) {
  modalError.textContent = "Le mot de passe est obligatoire pour ce pseudo.";
  modalError.style.display = 'block';
  return;
}





  
  // --- Ajout stockage mot de passe ---
  const usernameLower = username.toLowerCase();
const adminUsernamesLower = adminUsernames.map(u => u.toLowerCase());
const modoUsernamesLower = modoUsernames.map(u => u.toLowerCase());

if (adminUsernamesLower.includes(usernameLower) || modoUsernamesLower.includes(usernameLower)) {
  localStorage.setItem('password', password);
} else {
  localStorage.removeItem('password');
}

  // --- fin ajout ---

  modalError.style.display = 'none';
  socket.emit('set username', { username, gender, age, invisible: invisibleMode, password });
}


  // On écoute une seule fois 'username accepted' pour sauvegarder info et fermer modal
socket.once('username accepted', ({ username, gender, age }) => {
  if (gender === 'Autre') gender = 'Trans'; // ✅ Correction ici

  localStorage.setItem('username', username);
  localStorage.setItem('gender', gender);
  localStorage.setItem('age', age);

  document.getElementById('myModal').style.display = 'none';

  const chatWrapper = document.getElementById('chat-wrapper');
  if (chatWrapper) chatWrapper.style.display = 'block';
  else console.warn('⚠️ Élément #chat-wrapper introuvable');

  socket.emit('joinRoom', currentChannel);
  selectChannelInUI(currentChannel);

  hasSentUserInfo = true;
  initialLoadComplete = true;
});



  // Écouteurs socket divers
  socket.on('username error', msg => showBanner(msg, 'error'));
  socket.on('username exists', (username) => {
    const modalError = document.getElementById('modal-error');
    if (!modalError) return;
    modalError.textContent = `❌ Le nom "${username}" est déjà utilisé. Choisissez-en un autre.`;
    modalError.style.display = 'block';
  });

socket.on('chat history', messages => {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  chatMessages.innerHTML = '';

  messages.forEach(msg => {
    if (msg.username === 'Système' || msg.type === 'system') {
      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      appendSystemMessage(msg.message || msg.content, time);
    } else {
      addMessageToChat(msg);
    }
  });
});


socket.on('chat message', msg => {
  if (msg.type === 'system') {
    appendSystemMessage(msg.content, msg.timestamp);
    return;
  }

  // Sinon message normal
  addMessageToChat(msg);
});




  socket.on('user list', updateUserList);

  socket.on('room created', (newChannel) => {
    const channelList = document.getElementById('channel-list');
    if (!channelList) return;

    if (![...channelList.children].some(li => extractChannelName(li.textContent) === newChannel)) {
      const li = document.createElement('li');
      li.classList.add('channel');
      const emoji = channelEmojis[newChannel] || "🆕";
      li.textContent = `# ${emoji} ┊ ${newChannel} (0)`;
      li.addEventListener('click', () => {
        const clickedRoom = extractChannelName(li.textContent);
        if (clickedRoom === currentChannel) return;
        currentChannel = clickedRoom;
        localStorage.setItem('currentChannel', currentChannel);
        const chatMessages = document.getElementById('chat-messages');
        const input = document.getElementById('message-input');
        if (input) input.value = '';

        if (chatMessages) chatMessages.innerHTML = '';
        selectChannelInUI(currentChannel);
        socket.emit('joinRoom', currentChannel);
      });
      channelList.appendChild(li);
    }
    showBanner(`Salon "${newChannel}" créé avec succès !`, 'success');
  });

  socket.on('roomUserCounts', (counts) => {
  const channelList = document.getElementById('channel-list');
  if (!channelList) return;

  [...channelList.children].forEach(li => {
    const name = extractChannelName(li.textContent);
    if (name && counts[name] !== undefined) {
      const emoji = channelEmojis[name] || "💬";

      // Au lieu de modifier textContent qui supprime les enfants, on met à jour un span dédié (à créer si absent)
      let countSpan = li.querySelector('.user-count');
      if (!countSpan) {
        countSpan = document.createElement('span');
        countSpan.classList.add('user-count');
        li.appendChild(countSpan);
      }

      if (invisibleMode && name === currentChannel) {
        countSpan.textContent = '';  // Pas de nombre si invisible
        li.firstChild.textContent = `# ${emoji} ┊ ${name} `;
      } else {
        countSpan.textContent = ` (${counts[name]})`;
        li.firstChild.textContent = `# ${emoji} ┊ ${name} `;
      }
    }
  });
});


const sectionTitles = {
  "__LGBT__": "🌈 Lgbt",
  "__Regions__": "🌐 Régions",
  "__Adulte__": "🔞 Adulte",
  "__Salons Manager__": "🌴 Salons Manager",
  "__VOCAL__": "🎙️ Vocaux",
  "__SAFE__": "🛡️ Zone sûre"
};

socket.on('room list', (rooms) => {
  const channelList = document.getElementById('channel-list');
  if (!channelList) return;
  const previousChannel = currentChannel;
  channelList.innerHTML = '';

  const realRooms = [];

  rooms.forEach(channelName => {
    // 🎯 Affichage des titres séparateurs
if (channelName.startsWith('__') && channelName.endsWith('__')) {
  const li = document.createElement('li');
  li.className = 'channel-group-title';

  const rawText = sectionTitles[channelName] || channelName.replace(/^__|__$/g, '').toUpperCase();
  const emojiMatch = rawText.match(/^(\p{Emoji_Presentation}|\p{Emoji})/u);
  const emoji = emojiMatch ? emojiMatch[0] : '';
  const text = emoji ? rawText.replace(emoji, '').trim() : rawText;

  const emojiSpan = document.createElement('span');
  emojiSpan.className = 'emoji';
  emojiSpan.textContent = emoji;

  const textSpan = document.createElement('span');
  textSpan.className = 'texte-laser-italique';
  textSpan.textContent = text;

  li.appendChild(emojiSpan);
  li.appendChild(textSpan);
  channelList.appendChild(li);
  return;
}


    realRooms.push(channelName);

    const li = document.createElement('li');
    li.classList.add('channel');
    const emoji = channelEmojis[channelName] || "💬";
    li.textContent = `# ${emoji} ┊ ${channelName} (0)`;

    li.addEventListener('click', () => {
      const clickedRoom = extractChannelName(li.textContent);
      if (clickedRoom === currentChannel) return;
      currentChannel = clickedRoom;
      localStorage.setItem('currentChannel', currentChannel);
      const chatMessages = document.getElementById('chat-messages');
      const input = document.getElementById('message-input');
      if (input) input.value = '';

      if (chatMessages) chatMessages.innerHTML = '';
      selectChannelInUI(currentChannel);
      socket.emit('joinRoom', currentChannel);
    });

    channelList.appendChild(li);
  });

  // 🛑 Protection : on revient à Général seulement si nécessaire
  if (!realRooms.includes(previousChannel)) {
    currentChannel = 'Général';
    localStorage.setItem('currentChannel', currentChannel);
    socket.emit('joinRoom', currentChannel);
    const chatMessages = document.getElementById('chat-messages');
    const input = document.getElementById('message-input');
    if (input) input.value = '';

    if (chatMessages) chatMessages.innerHTML = '';
  }

  selectChannelInUI(currentChannel);
});






  // Ping périodique
  setInterval(() => {
    socket.emit('ping');
  }, 10000);

  // Création nouveau salon
// Création nouveau salon
document.getElementById('create-channel-button').addEventListener('click', () => {
  const input = document.getElementById('new-channel-name');
  if (!input) return;
  const newRoom = input.value.trim();
  if (!newRoom || newRoom.length > 10 || /\s/.test(newRoom)) {
    showBanner("Nom de salon invalide : pas d'espaces, max 10 caractères.", 'error');
    return;
  }

  socket.emit('createRoom', newRoom);
  input.value = '';
  input.focus();

  // 🔽 Scroll automatique vers le bas du bloc salons
  const wrapper = document.getElementById('channel-list-wrapper');
  if (wrapper) {
    wrapper.scrollTop = wrapper.scrollHeight;
  }
});


  // Envoi message avec touche Entrée
  document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  socket.on('connect', () => {
  const savedUsername = localStorage.getItem('username');
  const savedGender = localStorage.getItem('gender');
  const savedAge = localStorage.getItem('age');
  const savedPassword = localStorage.getItem('password'); // <-- ajout

  if (!hasSentUserInfo && savedUsername && savedAge) {
    socket.emit('set username', {
      username: savedUsername,
      gender: savedGender || 'non spécifié',
      age: savedAge,
      invisible: invisibleMode,
      password: savedPassword || ''  // <-- ajout
    });
    currentChannel = 'Général';
    localStorage.setItem('currentChannel', currentChannel);
    socket.emit('joinRoom', currentChannel);
    selectChannelInUI(currentChannel);

    hasSentUserInfo = true;
    initialLoadComplete = true;

    if (invisibleMode) {
      showBanner('Mode invisible activé (auto)', 'success');
    }
  }
});

  // Bouton validation pseudo
  document.getElementById('username-submit').addEventListener('click', submitUserInfo);

  // Emoji Picker
  const emojiButton = document.getElementById('emoji-button');
  const emojiPicker = document.getElementById('emoji-picker');
  const sendBtn = document.getElementById('send-button');
const messageInput = document.getElementById('message-input');

if (sendBtn && messageInput) {
  sendBtn.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message !== '') {
      const username = localStorage.getItem('username') || 'Anonyme';
      const gender = localStorage.getItem('gender') || 'non spécifié';
      const age = localStorage.getItem('age') || '';
      const role = localStorage.getItem('role') || ''; // si tu stockes le rôle
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      socket.emit('chat message', {
        username,
        gender,
        age,
        role,
        message,
        time
      });

      messageInput.value = '';
    }
  });

  // Entrée pour envoyer
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendBtn.click();
    }
  });
}


  if (emojiPicker && emojiButton && messageInput) {
    emojiPicker.style.display = 'none';

    emojiButton.addEventListener('click', (e) => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
    });

    emojiPicker.querySelectorAll('.emoji').forEach(emoji => {
      emoji.style.cursor = 'pointer';
      emoji.style.fontSize = '22px';
      emoji.style.margin = '5px';
      emoji.addEventListener('click', () => {
        messageInput.value += emoji.textContent;
        messageInput.focus();
        emojiPicker.style.display = 'none';
      });
    });

    document.addEventListener('click', () => {
      emojiPicker.style.display = 'none';
    });

    emojiPicker.addEventListener('click', e => {
      e.stopPropagation();
    });
  }

  function appendSystemMessage(content, time) {
  const msg = document.createElement('div');
  msg.classList.add('system-message');
  msg.innerHTML = `<span class="timestamp" style="font-style: italic; color: grey;">${time}</span> <i>${content}</i>`;
  const container = document.querySelector('.chat-messages');
  if (container) {
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }
}

  
  
function showModerationMenu(targetUsername, x, y) {
  const existing = document.getElementById('moderation-menu');
  if (existing) existing.remove();

  const myUsername = localStorage.getItem('username');
  if (targetUsername === myUsername) return;

  const me = userCache[myUsername];
  const target = userCache[targetUsername];
  if (!me || !target) return;

  const isRealAdmin = me.isRealAdmin === true;
  const isTargetProtected = target.isRealAdmin === true;
  if (!isRealAdmin && isTargetProtected) return;

  const isAdmin = me.role === 'admin';
  const isModo = me.role === 'modo';
  const isGlobalMod = isAdmin || isModo;

  const currentRoom = localStorage.getItem('currentRoom');
  const isRoomOwner = currentRoom && roomOwners[currentRoom] === myUsername;
  const isRoomModo = currentRoom && roomModerators[currentRoom]?.has(myUsername);

  const menu = document.createElement('div');
  menu.id = 'moderation-menu';
  menu.classList.add('moderation-context-menu');
  Object.assign(menu.style, {
    position: 'absolute',
    left: x + 'px',
    top: y + 'px',
    background: '#222',
    color: '#fff',
    border: '1px solid #555',
    borderRadius: '6px',
    padding: '6px 0',
    fontSize: '14px',
    minWidth: '180px',
    zIndex: '9999',
    boxShadow: '0 2px 10px rgba(0,0,0,0.4)'
  });

  const actions = [];

  // Commandes globales (uniquement pour les vrais modos globaux)
  if (isGlobalMod) {
    actions.push(
      { label: '👢 Kick', cmd: 'kick' },
      { label: '🚫 Ban', cmd: 'ban', adminOnly: true },
      { label: '🔇 Mute', cmd: 'mute' },
      { label: '🔊 Unmute', cmd: 'unmute' },
      { label: '👑 Ajouter Modo', cmd: 'addmodo', adminOnly: true },
      { label: '🟡 Ajouter Admin', cmd: 'addadmin', adminOnly: true },
      { label: '❌ Retirer Modo/Admin', cmd: ['removemodo', 'removeadmin'], adminOnly: true }
    );
  }

  // Commandes locales (uniquement pour les créateurs ou modos du salon, pas les modos globaux)
  if (!isGlobalMod && (isRoomOwner || isRoomModo)) {
    actions.push(
      { label: '👢 Kick (Salon)', cmd: 'kickroom' },
      { label: '🚫 Ban (Salon)', cmd: 'banroom' },
      { label: '♻️ Unban (Salon)', cmd: 'unbanroom' },
      { label: '👑 Ajouter Modo (Salon)', cmd: 'addroommodo', roomOnly: true },
      { label: '❌ Retirer Modo (Salon)', cmd: 'removeroommodo', roomOnly: true }
    );
  }

  actions.forEach(({ label, cmd, adminOnly }) => {
    if (adminOnly && !isAdmin) return;

    const item = document.createElement('div');
    item.textContent = label;
    item.style.padding = '6px 12px';
    item.style.cursor = 'pointer';

    item.addEventListener('mouseover', () => item.style.background = '#444');
    item.addEventListener('mouseout', () => item.style.background = 'transparent');

    item.addEventListener('click', () => {
      const cmdMap = {
        kick: 'kick',
        ban: 'ban',
        mute: 'mute',
        unmute: 'unmute',
        addmodo: 'addmodo',
        addadmin: 'addadmin',
        removemodo: 'removemodo',
        removeadmin: 'removeadmin',
        kickroom: 'kickroom',
        banroom: 'banroom',
        unbanroom: 'unbanroom',
        addroommodo: 'addroommodo',
        removeroommodo: 'removeroommodo'
      };

      const cmds = Array.isArray(cmd) ? cmd : [cmd];
      const cmdList = cmds.map(c => cmdMap[c]?.toUpperCase()).join(' + ');

      showConfirmBox(`Es-tu sûr de vouloir ${cmdList} pour ${targetUsername} ?`, () => {
        cmds.forEach(c => {
          const realCommand = cmdMap[c] || c;
          socket.emit('chat message', `/${realCommand} ${targetUsername}`);
        });
        menu.remove();
      });
    });

    menu.appendChild(item);
  });

  document.body.appendChild(menu);

  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 10);
}






function showConfirmBox(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  const box = document.createElement('div');
  box.className = 'confirm-box';
  box.innerHTML = `
    <p class="confirm-message">${message}</p>
    <div class="confirm-buttons">
      <button class="btn-confirm-yes">✅ Oui</button>
      <button class="btn-confirm-no">❌ Non</button>
    </div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  overlay.querySelector('.btn-confirm-yes').onclick = () => {
    onConfirm();
    overlay.remove();
  };
  overlay.querySelector('.btn-confirm-no').onclick = () => {
    overlay.remove();
  };
}

document.addEventListener('click', (e) => {
  const ageBox = e.target.closest('.gender-square');
  if (!ageBox) return;

  const userItem = ageBox.closest('.user-item');
  if (!userItem) return;

  const usernameSpan = userItem.querySelector('.username-span');
  if (!usernameSpan) return;

  const targetUsername = usernameSpan.textContent.trim();
  const target = userCache[targetUsername];
  if (!target) return;

  const myUsername = localStorage.getItem('username');
  const me = userCache[myUsername];
  if (!me) return;

  const rect = ageBox.getBoundingClientRect();
  const x = rect.right + window.scrollX;
  const y = rect.top + window.scrollY;

  const isGlobal = me.role === 'admin' || me.role === 'modo';
  const isOwner = window.roomOwners?.[currentRoom] === myUsername;
  const isRoomModo = window.roomModerators?.[currentRoom]?.has(myUsername);

  if (isGlobal) {
    showModerationMenu(targetUsername, x, y);
  } else if (isOwner || isRoomModo) {
    showRoomModerationMenu(targetUsername, x, y);
  }
});





  // Modération - Banni, kické, mute, unmute, erreurs, pas de permission
  socket.on('banned', () => {
    showBanner('🚫 Vous avez été banni du serveur.', 'error');
    socket.disconnect();
  });

  socket.on('kicked', () => {
    showBanner('👢 Vous avez été expulsé du serveur.', 'error');
    socket.disconnect();
  });

  socket.on('muted', () => {
    showBanner('🔇 Vous avez été muté et ne pouvez plus envoyer de messages.', 'error');
  });

  socket.on('unmuted', () => {
    showBanner('🔊 Vous avez été unmuté, vous pouvez à nouveau envoyer des messages.', 'success');
  });

  socket.on('error message', (msg) => {
    showBanner(`❗ ${msg}`, 'error');
  });

  socket.on('no permission', () => {
    showBanner("Vous n'avez pas les droits pour utiliser les commandes.", "error");
  });

  

  // --- Début ajout mode invisible ---

  if (invisibleBtn) {
    invisibleBtn.addEventListener('click', () => {
      invisibleMode = !invisibleMode;
      updateInvisibleButton();

      localStorage.setItem('invisibleMode', invisibleMode ? 'true' : 'false');

      if (invisibleMode) {
        socket.emit('chat message', { message: '/invisible on' });
        showBanner('Mode invisible activé', 'success');
        invisibleBtn.style.display = 'inline-block';
      } else {
        socket.emit('chat message', { message: '/invisible off' });
        showBanner('Mode invisible désactivé', 'success');
        if (!isAdmin) {
          invisibleBtn.style.display = 'none';
        }
      }
    });
  }

  // Mise à jour bouton mode invisible selon rôle
  socket.on('user list', (users) => {
  // Met à jour la liste des utilisateurs dans l'interface
  updateUserList(users);

  // Gestion bouton mode invisible pour admin avec mot de passe valide
  const username = localStorage.getItem('username');
  const userPassword = localStorage.getItem('password');
  const isOnAddAdminPage = window.location.pathname === '/addadmin';

  const me = users.find(u => u.username === username);

  if (me && me.role === 'admin' && userPassword && userPassword.length > 0 && !isOnAddAdminPage) {
    if (!isAdmin) isAdmin = true;
    if (invisibleBtn) {
      invisibleBtn.style.display = 'inline-block';
      updateInvisibleButton();
    }
  } else {
    if (isAdmin) {
      isAdmin = false;
      if (!invisibleMode && invisibleBtn) {
        invisibleBtn.style.display = 'none';
      }
    }
  }
});

socket.on('role update', ({ username, newRole }) => {
  if (userCache[username]) {
    userCache[username].role = newRole;
  }

  if (users) {
    users = users.map(u => u.username === username ? { ...u, role: newRole } : u);
  }

  updateUserList(users); // met à jour la couleur dans la liste d’utilisateurs

  // ✅ Mise à jour des couleurs dans les fenêtres privées
  const container = document.getElementById('private-chat-container');
  if (container) {
    container.querySelectorAll('.private-chat-window').forEach(win => {
      const winUsername = win.dataset.user;
      if (winUsername === username) {
        const title = win.querySelector('.private-chat-header span.username-text');
        if (title) {
          title.style.color =
            newRole === 'admin' ? usernameColors.admin :
            newRole === 'modo' ? usernameColors.modo :
            getUsernameColor(userCache[username]?.gender || 'non spécifié');
        }

        const icon = win.querySelector('.private-chat-header img');
        if (icon) icon.remove(); // Supprime l’ancien icône

        const newIcon = createRoleIcon(newRole);
        if (newIcon) {
          const header = win.querySelector('.private-chat-header');
          header.insertBefore(newIcon, title); // Ajoute le nouvel icône
        }
      }
    });
  }
});

socket.on('user list', list => {
  // Corriger tous les genres "Autre" en "Trans"
  list.forEach(u => {
    if (u.gender === 'Autre') u.gender = 'Trans';
  });

  users = list;
  userCache = {};
  list.forEach(u => {
    userCache[u.username] = u;
  });

  updateUserList(list);



  // Mise à jour couleurs fenêtres privées
  const container = document.getElementById('private-chat-container');
  if (container) {
    container.querySelectorAll('.private-chat-window').forEach(win => {
      const username = win.dataset.user;
      const user = userCache[username];
      const title = win.querySelector('.private-chat-header span.username-text');
      if (user && title) {
        title.style.color = user.role === 'admin'
          ? usernameColors.admin
          : user.role === 'modo'
          ? usernameColors.modo
          : getUsernameColor(user.gender);
      }
    });
  }
});







  // --- Fin ajout mode invisible ---

 socket.on('redirect', (url) => {
  console.log('Redirect demandé vers:', url);
  if (typeof url === 'string' && url.length > 0) {
    window.location.href = url;
  }
});

const colorTextBtn = document.getElementById('color-text');
const styleMenu = document.getElementById('style-menu');
const styleColor = document.getElementById('style-color');
const styleBold = document.getElementById('style-bold');
const styleItalic = document.getElementById('style-italic');
const styleFont = document.getElementById('style-font');

const defaultStyle = {
  color: '#ffffff',
  bold: false,
  italic: false,
  font: 'Arial'
};

function loadSavedStyle() {
  const saved = localStorage.getItem('chatStyle');
  if (saved) {
    const style = JSON.parse(saved);
    return {
      color: style.color || '#fff',
      bold: style.bold || false,
      italic: style.italic || false,
      font: style.font || 'Arial'  // ← ✅ ajout police par défaut
    };
  } else {
    return {
      color: '#fff',
      bold: false,
      italic: false,
      font: 'Arial'
    };
  }
}

function saveStyle(style) {
  localStorage.setItem('chatStyle', JSON.stringify(style));
}

function applyStyleToInput(style) {
  const inputs = [
    document.getElementById('message-input'),
    document.getElementById('new-channel-name')
  ];

  inputs.forEach(input => {
    if (!input) return;

    input.style.color = style.color;
    input.style.fontWeight = style.bold ? 'bold' : 'normal';
    input.style.fontStyle = style.italic ? 'italic' : 'normal';
    input.style.fontFamily = style.font;
    input.style.padding = '0 12px';
    input.style.boxSizing = 'border-box';

    // 🎯 Hauteur spécifique par champ
    if (input.id === 'message-input') {
      input.style.height = '45px';
      input.style.lineHeight = '48px';
    } else if (input.id === 'new-channel-name') {
      input.style.height = '30px';
      input.style.lineHeight = '40px';
    }
  });
}

// 🟢 Chargement au démarrage
const currentStyle = loadSavedStyle();
styleColor.value = currentStyle.color;
styleBold.checked = currentStyle.bold;
styleItalic.checked = currentStyle.italic;
styleFont.value = currentStyle.font || 'Arial'; // 🔒 au cas où DOM n'aime pas undefined
applyStyleToInput(currentStyle);


// 🎨 toggle menu
colorTextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  styleMenu.style.display = styleMenu.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('click', () => {
  styleMenu.style.display = 'none';
});

styleMenu.addEventListener('click', e => e.stopPropagation());

// Mise à jour et sauvegarde des styles
[styleColor, styleBold, styleItalic, styleFont].forEach(el => {
  el.addEventListener('input', () => {
    const newStyle = {
      color: styleColor.value,
      bold: styleBold.checked,
      italic: styleItalic.checked,
      font: styleFont.value
    };
    saveStyle(newStyle);
    applyStyleToInput(newStyle);

    // AJOUT À FAIRE ICI :
    Object.assign(currentStyle, newStyle);
    updateAllPrivateChatsStyle(newStyle);
  });
});


// --- Upload fichier ---
const uploadInput = document.getElementById('file-input');    // input type="file"
const uploadButton = document.getElementById('upload-btn');   // bouton 📎 ou autre

if (uploadInput && uploadButton) {
  uploadButton.addEventListener('click', () => {
    uploadInput.click();
  });

  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files[0];
    if (!file) return;

    const MAX_SIZE = 50 * 1024 * 1024; // 50 Mo max
    if (file.size > MAX_SIZE) {
      showBanner('Le fichier est trop volumineux (50 Mo max conseillés).', 'error');
      uploadInput.value = ''; // reset input
      return;
    }

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

      uploadInput.value = ''; // reset après l'envoi
    };

    reader.readAsArrayBuffer(file);
  });
}  // <-- fermeture du if uploadInput && uploadButton

// Affichage d’un fichier uploadé

const displayedFileUsers = new Set();

function insertMention(username) {
  const input = document.getElementById('message-input');
  if (!input) return;

  const mention = '@' + username;

  if (input.value.includes(mention)) return;

  const start = input.selectionStart || 0;
  const end = input.selectionEnd || 0;

  const textBefore = input.value.substring(0, start);
  const textAfter = input.value.substring(end);

  input.value = textBefore + mention + ' ' + textAfter;

  const newPos = start + mention.length + 1;
  input.setSelectionRange(newPos, newPos);
  input.focus();
}

socket.on('file uploaded', ({ username, filename, data, mimetype, timestamp, role, gender }) => {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const wrapper = document.createElement('div');
  wrapper.classList.add('message');

  // Timestamp
  const timeSpan = document.createElement('span');
  timeSpan.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ';
  timeSpan.style.color = '#888';
  timeSpan.style.fontStyle = 'italic';
  timeSpan.style.marginRight = '5px';
  wrapper.appendChild(timeSpan);

  // Pseudo + icône
  const usernameContainer = document.createElement('span');
  usernameContainer.style.fontWeight = 'bold';
  usernameContainer.style.marginRight = '4px';
  usernameContainer.style.display = 'inline-flex';
  usernameContainer.style.alignItems = 'center';
  usernameContainer.style.position = 'relative';
  usernameContainer.style.top = '2px';

  let color = 'white';
  if (role === 'admin') color = 'red';
  else if (role === 'modo') color = 'limegreen';
  else if (gender === 'Femme') color = '#f0f';
  else if (gender === 'Homme') color = 'dodgerblue';
  usernameContainer.style.color = color;

  if (role === 'admin' || role === 'modo') {
    const icon = createRoleIcon(role);
    if (icon) {
      icon.style.width = '17px';
      icon.style.height = '15px';
      icon.style.marginRight = '2px';
      icon.style.verticalAlign = '-1px';
      usernameContainer.appendChild(icon);
    }
  }

  const clickableUsername = document.createElement('span');
  clickableUsername.textContent = username;
  clickableUsername.style.cursor = 'pointer';

  clickableUsername.addEventListener('click', () => {
    insertMention(username);
  });

  usernameContainer.appendChild(clickableUsername);
  wrapper.appendChild(usernameContainer);

  // Affichage du fichier
  if (mimetype.startsWith('image/')) {
    const img = document.createElement('img');
    img.src = `data:${mimetype};base64,${data}`;
    img.style.maxWidth = '100px';
    img.style.cursor = 'pointer';
    img.style.border = '2px solid #007bff';
    img.style.borderRadius = '8px';
    img.style.padding = '4px';

    const link = document.createElement('a');
    link.href = '#';
    link.style.cursor = 'pointer';
    link.appendChild(img);

    link.addEventListener('click', (e) => {
      e.preventDefault();
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>${filename}</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;background:#000;">
              <img src="${img.src}" alt="${filename}" style="max-width:100vw; max-height:100vh;" />
            </body>
          </html>
        `);
        newWindow.document.close();
      } else {
        alert('Impossible d’ouvrir un nouvel onglet, vérifie le bloqueur de popups.');
      }
    });

    img.onload = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    wrapper.appendChild(link);

  } else if (mimetype.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true;
    audio.src = `data:${mimetype};base64,${data}`;
    audio.style.marginTop = '4px';
    audio.style.border = '2px solid #007bff';
    audio.style.borderRadius = '8px';
    audio.style.padding = '4px';
    audio.style.backgroundColor = '#343a40';
    audio.onloadeddata = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    wrapper.appendChild(audio);

  } else if (mimetype.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true;
    video.src = `data:${mimetype};base64,${data}`;
    video.style.maxWidth = '300px';
    video.style.maxHeight = '300px';
    video.style.marginTop = '4px';
    video.style.border = '2px solid #007bff';
    video.style.borderRadius = '8px';
    video.style.padding = '4px';
    video.style.backgroundColor = '#000';
    video.onloadeddata = () => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };
    wrapper.appendChild(video);

  } else {
    const link = document.createElement('a');
    link.href = `data:${mimetype};base64,${data}`;
    link.download = filename;
    link.textContent = `📎 ${filename}`;
    link.target = '_blank';
    wrapper.appendChild(link);
  }


  chatMessages.appendChild(wrapper);
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 0);
});
