const socket = io();

document.addEventListener('DOMContentLoaded', () => {

  // ── 1) Stockage et mise à jour de la liste users ──
  let users = [];
  let userCache = {};

  socket.on('user list', list => {
    users = list;
    userCache = {};
    list.forEach(u => {
      userCache[u.username] = u;
    });
    updateUserList(list);

    // Met à jour les couleurs des fenêtres privées ouvertes (header)
    const container = document.getElementById('private-chat-container');
    if (container) {
      const windows = container.querySelectorAll('.private-chat-window');
      windows.forEach(win => {
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
    Autre: '#0ff',
    'non spécifié': '#aaa',
    default: '#aaa'
  };

  // Fonction utilitaire pour créer une icône selon le rôle
  function createRoleIcon(role) {
    if (role === 'admin') {
      const icon = document.createElement('img');
      icon.src = '/diamond.ico'; // adapte le chemin si besoin
      icon.alt = 'Admin';
      icon.title = 'Admin';
      icon.style.width = '17px';
      icon.style.height = '15px';
      icon.style.marginRight = '6px';
      icon.style.verticalAlign = 'middle';
      return icon;
    } else if (role === 'modo') {
      const icon = document.createElement('img');
      icon.src = '/favicon.ico'; // adapte le chemin si besoin
      icon.alt = 'Modérateur';
      icon.title = 'Modérateur';
      icon.style.width = '16px';
      icon.style.height = '16px';
      icon.style.marginRight = '6px';
      icon.style.verticalAlign = 'middle';
      return icon;
    }
    return null;
  }
  
  // ── 3) Ouvre ou remonte une fenêtre privée ──
  function openPrivateChat(username, role, gender) {
    const container = document.getElementById('private-chat-container');
    let win = container.querySelector(`.private-chat-window[data-user="${username}"]`);
    if (win) {
      container.appendChild(win);
      return;
    }

    // Si role/genre non passés, tente de récupérer depuis userCache
    if (!role || !gender) {
      const cachedUser = userCache[username];
      if (cachedUser) {
        role = role || cachedUser.role;
        gender = gender || cachedUser.gender;
      }
    }

    // Création de la fenêtre
    win = document.createElement('div');
    win.classList.add('private-chat-window');
    win.dataset.user = username;

    // Header
    const header = document.createElement('div');
    header.classList.add('private-chat-header');

    // Icône rôle
    const icon = createRoleIcon(role);
    if (icon) header.appendChild(icon);

    // Pseudo en span distinct (pour mise à jour couleur plus simple)
    const title = document.createElement('span');
    title.classList.add('username-text');
    title.textContent = username;
    title.style.color = (role === 'admin') ? usernameColors.admin
                      : (role === 'modo') ? usernameColors.modo
                      : (usernameColors[gender] || usernameColors.default);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => container.removeChild(win);

    header.append(title, closeBtn);

    // Body et input
    const body = document.createElement('div');
    body.classList.add('private-chat-body');

    // Barre d'input avec emoji picker
    const inputBar = document.createElement('div');
    inputBar.classList.add('private-chat-input');
    inputBar.style.position = 'relative'; // Pour positionner le picker

    const input = document.createElement('input');
    input.placeholder = 'Message…';

    // Bouton emoji
    const emojiBtn = document.createElement('button');
    emojiBtn.textContent = '😊';
    emojiBtn.title = 'Insérer un émoji';
    emojiBtn.style.fontSize = '20px';
    emojiBtn.style.background = 'transparent';
    emojiBtn.style.border = 'none';
    emojiBtn.style.cursor = 'pointer';
    emojiBtn.style.marginRight = '5px';

    // Emoji picker (conteneur)
    const emojiPicker = document.createElement('div');
    emojiPicker.classList.add('emoji-picker');
    emojiPicker.style.display = 'none';
    emojiPicker.style.position = 'absolute';
    emojiPicker.style.bottom = '40px';
    emojiPicker.style.left = '0px';
    emojiPicker.style.background = '#222';
    emojiPicker.style.padding = '8px';
    emojiPicker.style.borderRadius = '8px';
    emojiPicker.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    emojiPicker.style.zIndex = '1000';
    emojiPicker.style.maxWidth = '200px';
    emojiPicker.style.flexWrap = 'wrap';

    // Liste d'émojis à afficher dans le picker
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

    // Toggle affichage picker emoji au clic bouton
    emojiBtn.addEventListener('click', e => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'flex' : 'none';
    });

    // Clic hors picker ferme le picker
    document.addEventListener('click', () => {
      emojiPicker.style.display = 'none';
    });

    // Empêche la fermeture au clic dans le picker
    emojiPicker.addEventListener('click', e => {
      e.stopPropagation();
    });

    // --- AJOUT BOUTON UPLOAD FICHIER ---
    // input type=file caché
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';

    // bouton upload
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '📎';
    uploadBtn.title = 'Envoyer un fichier';
    uploadBtn.style.fontSize = '20px';
    uploadBtn.style.background = 'transparent';
    uploadBtn.style.border = 'none';
    uploadBtn.style.cursor = 'pointer';
    uploadBtn.style.marginRight = '5px';

    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  const MAX_SIZE = 50 * 1024 * 1024; // 50 Mo max

  if (file.size > MAX_SIZE) {
    alert('Le fichier est trop volumineux (max 50 Mo)');
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const arrayBuffer = reader.result;

    // Conversion en base64
    const base64 = btoa(
      new Uint8Array(arrayBuffer)
        .reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Envoi au serveur
    socket.emit('upload private file', {
      to: username,
      filename: file.name,
      mimetype: file.type,
      data: base64,
      timestamp: new Date().toISOString()
    });

    // Affichage local dans la fenêtre privée
    const myUsername = localStorage.getItem('username') || 'moi';
    const container = document.getElementById('private-chat-container');
    let win = container.querySelector(`.private-chat-window[data-user="${username}"]`);
    if (!win) {
      openPrivateChat(username);
      win = container.querySelector(`.private-chat-window[data-user="${username}"]`);
      if (!win) return; // Si pas de fenêtre, on arrête
    }
    const body = win.querySelector('.private-chat-body');

    // Création du message affichant le fichier
    const msgDiv = document.createElement('div');
    msgDiv.style.margin = '4px 0';

    const who = document.createElement('span');
    who.style.fontWeight = 'bold';
    who.style.marginRight = '4px';
    who.style.display = 'inline-flex';
    who.style.alignItems = 'center';

    const icon = createRoleIcon('user'); // Ici 'user' car c’est toi-même
    if (icon) who.appendChild(icon);

    const usernameText = document.createTextNode(myUsername + ': ');
    who.appendChild(usernameText);
    who.style.color = usernameColors.default;

    msgDiv.appendChild(who);

    // Affichage selon type mimetype
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = `data:${file.type};base64,${base64}`;
      img.style.maxWidth = '150px';
      img.style.cursor = 'pointer';
      img.style.border = '2px solid #ccc';
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
      audio.style.border = '2px solid #ccc';
      audio.style.borderRadius = '8px';
      audio.style.padding = '4px';
      audio.style.backgroundColor = '#f9f9f9';
      msgDiv.appendChild(audio);

    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = `data:${file.type};base64,${base64}`;
      video.style.maxWidth = '300px';
      video.style.maxHeight = '300px';
      video.style.marginTop = '4px';
      video.style.border = '2px solid #ccc';
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

    fileInput.value = ''; // Reset input
  };

  reader.readAsArrayBuffer(file);
});


    // Assemblage inputBar avec nouveau bouton upload
    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'Envoyer';
    sendBtn.title = 'Envoyer le message';
    sendBtn.style.cursor = 'pointer';
    sendBtn.style.marginLeft = '5px';
    sendBtn.style.padding = '4px 8px';

    inputBar.append(emojiBtn, emojiPicker, uploadBtn, fileInput, input, sendBtn);

    sendBtn.onclick = () => {
  const text = input.value.trim();
  if (!text) return;
  socket.emit('private message', { to: username, message: text });
  const myUsername = localStorage.getItem('username') || 'moi';
  appendPrivateMessage(body, myUsername, text);
  input.value = '';
};


    // --- FIN AJOUT ---

    // Afficher localement le message envoyé
    sendBtn.onclick = () => {
      const text = input.value.trim();
      if (!text) return;
      socket.emit('private message', { to: username, message: text });
      const myUsername = localStorage.getItem('username') || 'moi';
      appendPrivateMessage(body, myUsername, text);

      input.value = '';
    };

    input.addEventListener('keypress', e => { if (e.key === 'Enter') sendBtn.click(); });

    // Assemblage fenêtre
    win.append(header, body, inputBar);

    // Positionnement initial
    win.style.position = 'absolute';
    win.style.bottom = '20px';
    win.style.right = '20px';

    // --- Drag & Drop ---
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

      const winWidth = win.offsetWidth;
      const winHeight = win.offsetHeight;

      const maxLeft = window.innerWidth - winWidth;
      const maxTop = window.innerHeight - winHeight;

      const clampedLeft = Math.max(0, Math.min(newLeft, maxLeft));
      const clampedTop = Math.max(0, Math.min(newTop, maxTop));

      win.style.left = clampedLeft + 'px';
      win.style.top = clampedTop + 'px';
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

  // ── 4) Ajoute un message dans la fenêtre privée ──
  // Ajout role et gender en paramètres
  function appendPrivateMessage(bodyElem, from, text, role, gender) {
    const msgDiv = document.createElement('div');
    msgDiv.style.margin = '4px 0';

    // Span pseudo (bold + couleur + icône)
    const who = document.createElement('span');
    who.style.fontWeight = 'bold';
    who.style.marginRight = '4px';
    who.style.display = 'inline-flex';
    who.style.alignItems = 'center';

    // Priorité stricte rôle > genre
    let userRole = role;
    let userGender = gender;

    if (!userRole || !userGender) {
      const cachedUser = userCache[from];
      if (cachedUser) {
        userRole = userRole || cachedUser.role;
        userGender = userGender || cachedUser.gender;
      }
    }

    // Icône si admin ou modo
    const icon = createRoleIcon(userRole);
    if (icon) who.appendChild(icon);

    const usernameText = document.createTextNode(from + ': ');
    who.appendChild(usernameText);

    if (userRole === 'admin') {
      who.style.color = usernameColors.admin;
    } else if (userRole === 'modo') {
      who.style.color = usernameColors.modo;
    } else {
      who.style.color = usernameColors[userGender] || usernameColors.default;
    }

    msgDiv.append(who, document.createTextNode(text));
    bodyElem.appendChild(msgDiv);
    bodyElem.scrollTop = bodyElem.scrollHeight;
  }

  // ── 5) Clic sur un pseudo pour ouvrir la fenêtre ──
  document.addEventListener('click', e => {
    const span = e.target.closest('.clickable-username');
    if (!span) return;
    const username = span.textContent.trim();
    const userObj = userCache[username];
    if (!userObj) return;
    openPrivateChat(username, userObj.role, userObj.gender);
  });

  // ── 6) Réception d'un message privé ──
  // On attend role et gender dans l’objet message reçu du serveur
  socket.on('private message', ({ from, message, role, gender }) => {
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

    appendPrivateMessage(body, from, message, role, gender);
  });

  // ── 7) Réception d’un fichier privé ──
  socket.on('private file', ({ from, filename, data, mimetype, timestamp, role, gender }) => {
    const container = document.getElementById('private-chat-container');
    if (!container) return;

    let win = container.querySelector(`.private-chat-window[data-user="${from}"]`);

    // Ouvre la fenêtre si pas ouverte
    if (!win) {
      const userObj = userCache[from] || {};
      openPrivateChat(from, userObj.role, userObj.gender);
      win = container.querySelector(`.private-chat-window[data-user="${from}"]`);
      if (!win) return;
    }

    const body = win.querySelector('.private-chat-body');

    // Crée un conteneur message
    const msgDiv = document.createElement('div');
    msgDiv.style.margin = '4px 0';

    // Pseudo + icône rôle
    const who = document.createElement('span');
    who.style.fontWeight = 'bold';
    who.style.marginRight = '4px';
    who.style.display = 'inline-flex';
    who.style.alignItems = 'center';

    // Priorité stricte rôle > genre
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

    const usernameText = document.createTextNode(from + ': ');
    who.appendChild(usernameText);

    if (userRole === 'admin') {
      who.style.color = usernameColors.admin;
    } else if (userRole === 'modo') {
      who.style.color = usernameColors.modo;
    } else {
      who.style.color = usernameColors[userGender] || usernameColors.default;
    }

    msgDiv.appendChild(who);

    // Affichage du fichier selon type mimetype
    if (mimetype.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = `data:${mimetype};base64,${data}`;
      img.style.maxWidth = '150px';
      img.style.cursor = 'pointer';
      img.style.border = '2px solid #ccc';
      img.style.borderRadius = '8px';
      img.style.padding = '4px';
      // Clique pour ouvrir en grand
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
      audio.style.border = '2px solid #ccc';
      audio.style.borderRadius = '8px';
      audio.style.padding = '4px';
      msgDiv.appendChild(audio);

    } else if (mimetype.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = `data:${mimetype};base64,${data}`;
      video.style.maxWidth = '300px';
      video.style.maxHeight = '300px';
      video.style.marginTop = '4px';
      video.style.border = '2px solid #ccc';
      video.style.borderRadius = '8px';
      video.style.padding = '4px';
      msgDiv.appendChild(video);

    } else {
      // Fichier générique : lien téléchargement
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













 const adminUsernames = ['MaEvA'];
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
    Autre: '#0ff',
    'non spécifié': '#aaa',
    default: '#aaa'
  };

  const channelEmojis = {
    "Général": "💬",
    "Musique": "🎧",
    "Gaming": "🎮",
    "Détente": "🌿"
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

  // Met à jour la liste des utilisateurs affichée
  function updateUserList(users) {
  const userList = document.getElementById('users');
  if (!userList) return;
  userList.innerHTML = '';
  if (!Array.isArray(users)) return;

  users.forEach(user => {
    const username = user?.username || 'Inconnu';
    const age = user?.age || '?';
    const gender = user?.gender || 'non spécifié';
    const role = user?.role || 'user';

    const li = document.createElement('li');
    li.classList.add('user-item');

    const color = role === 'admin' ? 'red' : role === 'modo' ? 'limegreen' : getUsernameColor(gender);

    li.innerHTML = `
      <span class="role-icon"></span> 
      <div class="gender-square" style="background-color: ${getUsernameColor(gender)}">${age}</div>
      <span class="username-span clickable-username" style="color: ${color}" title="${role === 'admin' ? 'Admin' : role === 'modo' ? 'Modérateur' : ''}">${username}</span>
    `;

    const roleIconSpan = li.querySelector('.role-icon');
    const icon = createRoleIcon(role);
    if (icon) roleIconSpan.appendChild(icon);

    const usernameSpan = li.querySelector('.username-span');
    usernameSpan.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      const mention = `@${username} `;
      if (!input.value.includes(mention)) input.value = mention + input.value;
      input.focus();
      selectedUser = username;
    });

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
    usernameSpan.addEventListener('click', () => {
      const input = document.getElementById('message-input');
      const mention = `@${msg.username} `;
      if (!input.value.includes(mention)) input.value = mention + input.value;
      input.focus();
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

  socket.on('chat history', (messages) => {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    messages.forEach(addMessageToChat);
  });

  socket.on('chat message', addMessageToChat);
  socket.on('server message', (msg) => {
  const message = {
    username: 'Système',
    message: msg,
    timestamp: new Date().toISOString()
  };
  addMessageToChat(message);
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


  socket.on('room list', (rooms) => {
    const channelList = document.getElementById('channel-list');
    if (!channelList) return;
    const previousChannel = currentChannel;

    channelList.innerHTML = '';

    rooms.forEach(channelName => {
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
        if (chatMessages) chatMessages.innerHTML = '';
        selectChannelInUI(currentChannel);
        socket.emit('joinRoom', currentChannel);
      });

      channelList.appendChild(li);
    });

    if (!rooms.includes(previousChannel)) {
      currentChannel = 'Général';
      localStorage.setItem('currentChannel', currentChannel);
      socket.emit('joinRoom', currentChannel);
      const chatMessages = document.getElementById('chat-messages');
      if (chatMessages) chatMessages.innerHTML = '';
    }

    selectChannelInUI(currentChannel);
  });

  // Ping périodique
  setInterval(() => {
    socket.emit('ping');
  }, 10000);

  // Création nouveau salon
  document.getElementById('create-channel-button').addEventListener('click', () => {
    const input = document.getElementById('new-channel-name');
    if (!input) return;
    const newRoom = input.value.trim();
    if (!newRoom || newRoom.length > 20 || /\s/.test(newRoom)) {
      showBanner("Nom de salon invalide : pas d'espaces, max 20 caractères.", 'error');
      return;
    }
    socket.emit('createRoom', newRoom);
    input.value = '';
    input.focus();
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
  const messageInput = document.getElementById('message-input');

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
  return saved ? JSON.parse(saved) : defaultStyle;
}

function saveStyle(style) {
  localStorage.setItem('chatStyle', JSON.stringify(style));
}

function applyStyleToInput(style) {
  const input = document.getElementById('message-input');
  if (!input) return;
  input.style.color = style.color;
  input.style.fontWeight = style.bold ? 'bold' : 'normal';
  input.style.fontStyle = style.italic ? 'italic' : 'normal';
  input.style.fontFamily = style.font;
}

const currentStyle = loadSavedStyle();
styleColor.value = currentStyle.color;
styleBold.checked = currentStyle.bold;
styleItalic.checked = currentStyle.italic;
styleFont.value = currentStyle.font;
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
    img.style.border = '2px solid #ccc';
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
    audio.style.border = '2px solid #ccc';
    audio.style.borderRadius = '8px';
    audio.style.padding = '4px';
    audio.style.backgroundColor = '#f9f9f9';
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
    video.style.border = '2px solid #ccc';
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
