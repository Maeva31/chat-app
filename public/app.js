document.addEventListener('DOMContentLoaded', () => {
    const socket = io();

    // Authentification
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pseudo = document.getElementById('pseudo').value.trim();
        const genre = document.getElementById('genre').value;
        const age = document.getElementById('age').value;
        const role = document.getElementById('role').value;

        if (!pseudo) return alert("Pseudo requis");
        localStorage.setItem('user', JSON.stringify({ pseudo, genre, age, role }));
        socket.emit('auth', { pseudo, genre, age, role });
        document.getElementById('login').style.display = 'none';
        document.getElementById('chat').style.display = 'block';
    });

    // Message
    document.getElementById('message-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = document.getElementById('message').value.trim();
        if (!text) return;
        const font = document.getElementById('font').value;
        const color = document.getElementById('color').value;
        socket.emit('send-message', { text, font, color });
        document.getElementById('message').value = '';
    });

    // Fichier
    document.getElementById('file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            socket.emit('send-file', {
                type: file.type,
                fileData: reader.result,
                fileName: file.name
            });
        };
        reader.readAsDataURL(file);
    });

    // Emojis
    document.getElementById('emoji-btn').addEventListener('click', () => {
        const emojis = ['😀','😂','😍','🥺','🤔','😎','🔥','😢','🎉','👍','💀','❤️'];
        const palette = document.getElementById('emoji-palette');
        palette.innerHTML = '';
        emojis.forEach(e => {
            const btn = document.createElement('button');
            btn.textContent = e;
            btn.addEventListener('click', () => {
                document.getElementById('message').value += e;
                palette.style.display = 'none';
            });
            palette.appendChild(btn);
        });
        palette.style.display = palette.style.display === 'block' ? 'none' : 'block';
    });

    // Affichage
    socket.on('new-message', displayMessage);
    socket.on('file-message', displayFile);
    socket.on('history', msgs => {
        document.getElementById('messages').innerHTML = '';
        msgs.forEach(m => m.text ? displayMessage(m) : displayFile(m));
    });
    socket.on('user-list', updateUserList);
    socket.on('private-message', showPrivateMessage);
    socket.on('kicked', () => alert("Vous avez été expulsé."));
    socket.on('banned', () => alert("Vous avez été banni."));

    function displayMessage({ pseudo, genre, age, role, text, font, color, time }) {
        const msg = document.createElement('div');
        const userColor = genre === 'homme' ? 'blue' : genre === 'femme' ? 'hotpink' : 'gray';
        const badgeColor = role === 'admin' ? 'red' : role === 'modo' ? 'green' : 'white';
        const mention = text.includes(getPseudo()) ? 'mention' : '';

        msg.className = `message ${mention}`;
        msg.innerHTML = `<span style="color:${badgeColor}; font-weight:bold">[${role}]</span> 
        <span class="pseudo" data-pseudo="${pseudo}" style="color:${userColor}">${pseudo}</span> 
        (${age}) <span class="time">${time}</span>: 
        <span style="font-family:${font}; color:${color}">${text}</span>`;

        document.getElementById('messages').appendChild(msg);
        msg.scrollIntoView();
    }

    function displayFile({ pseudo, genre, age, role, fileType, fileData, fileName, time }) {
        const ext = fileType.split('/')[0];
        const container = document.createElement('div');
        const userColor = genre === 'homme' ? 'blue' : genre === 'femme' ? 'hotpink' : 'gray';
        const badgeColor = role === 'admin' ? 'red' : role === 'modo' ? 'green' : 'white';

        container.className = "message";
        container.innerHTML = `<span style="color:${badgeColor}; font-weight:bold">[${role}]</span> 
        <span class="pseudo" data-pseudo="${pseudo}" style="color:${userColor}">${pseudo}</span> 
        (${age}) <span class="time">${time}</span>: `;

        if (ext === 'image') {
            const img = new Image();
            img.src = fileData;
            img.style.maxWidth = "200px";
            container.appendChild(img);
        } else if (ext === 'video') {
            const video = document.createElement('video');
            video.src = fileData;
            video.controls = true;
            video.style.maxWidth = "200px";
            container.appendChild(video);
        } else if (ext === 'audio') {
            const audio = document.createElement('audio');
            audio.src = fileData;
            audio.controls = true;
            container.appendChild(audio);
        } else {
            const link = document.createElement('a');
            link.href = fileData;
            link.download = fileName;
            link.textContent = `Télécharger ${fileName}`;
            container.appendChild(link);
        }

        document.getElementById('messages').appendChild(container);
        container.scrollIntoView();
    }

    function updateUserList(users) {
        const list = document.getElementById('users');
        list.innerHTML = '';
        users.forEach(u => {
            const li = document.createElement('li');
            const userColor = u.genre === 'homme' ? 'blue' : u.genre === 'femme' ? 'hotpink' : 'gray';
            const badgeColor = u.role === 'admin' ? 'red' : u.role === 'modo' ? 'green' : 'white';

            li.innerHTML = `<span style="color:${badgeColor}">[${u.role}]</span> 
            <span class="pseudo" data-pseudo="${u.pseudo}" style="color:${userColor}">${u.pseudo}</span> (${u.age})`;

            list.appendChild(li);
        });
    }

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('pseudo')) {
            const target = e.target.dataset.pseudo;
            const tabs = document.getElementById('private-tabs');
            const tabId = `mp-${target}`;
            if (!document.getElementById(tabId)) {
                const tab = document.createElement('div');
                tab.id = tabId;
                tab.className = 'private-tab';
                tab.innerHTML = `<h3>MP avec ${target}</h3>
                    <div class="mp-messages" id="log-${target}"></div>
                    <form class="mp-form"><input type="text" placeholder="Message privé"><button>Envoyer</button></form>`;
                tabs.appendChild(tab);

                tab.querySelector('form').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const msg = tab.querySelector('input').value;
                    if (!msg) return;
                    socket.emit('private-message', { to: target, message: msg });
                    tab.querySelector(`#log-${target}`).innerHTML += `<div class="self">Vous: ${msg}</div>`;
                    tab.querySelector('input').value = '';
                });
            }
        }
    });

    function showPrivateMessage({ from, message, time }) {
        const log = document.getElementById(`log-${from}`);
        if (log) {
            log.innerHTML += `<div>${from} (${time}): ${message}</div>`;
        }
    }

    function getPseudo() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user).pseudo : '';
    }
});
