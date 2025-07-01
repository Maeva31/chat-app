export const adminUsernames = ['MaEvA'];
export const modoUsernames = ['DarkGirL'];

export function handlePasswordFieldDisplay(usernameInput, passwordInput) {
  if (!usernameInput || !passwordInput) return;
  usernameInput.addEventListener('input', () => {
    const val = usernameInput.value.trim();
    if (adminUsernames.includes(val) || modoUsernames.includes(val)) {
      passwordInput.style.display = 'block';
    } else {
      passwordInput.style.display = 'none';
      passwordInput.value = '';
    }
  });
  const initialUsername = usernameInput.value.trim();
  if (adminUsernames.includes(initialUsername) || modoUsernames.includes(initialUsername)) {
    passwordInput.style.display = 'block';
  }
}

export function submitUserInfo(socket, invisibleMode) {
  const usernameInput = document.getElementById('username-input');
  const passwordInput = document.getElementById('password-input');
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

  const usernameLower = username.toLowerCase();
  const adminUsernamesLower = adminUsernames.map(u => u.toLowerCase());
  const modoUsernamesLower = modoUsernames.map(u => u.toLowerCase());

  if (adminUsernamesLower.includes(usernameLower) || modoUsernamesLower.includes(usernameLower)) {
    localStorage.setItem('password', password);
  } else {
    localStorage.removeItem('password');
  }

  modalError.style.display = 'none';
  socket.emit('set username', { username, gender, age, invisible: invisibleMode, password });
}
