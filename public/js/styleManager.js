export function loadSavedStyle() {
  const styleJSON = localStorage.getItem('chatStyle');
  if (!styleJSON) {
    return { font: 'Arial, sans-serif', color: '#ffffff', bold: false, italic: false };
  }
  try {
    return JSON.parse(styleJSON);
  } catch {
    return { font: 'Arial, sans-serif', color: '#ffffff', bold: false, italic: false };
  }
}

export function initStyleManager() {
  const styleButton = document.getElementById('styleButton');
  const styleMenu = document.getElementById('styleMenu');
  const messageInput = document.getElementById('message-input');

  if (!styleButton || !styleMenu || !messageInput) return;

  styleButton.addEventListener('click', () => {
    styleMenu.style.display = styleMenu.style.display === 'block' ? 'none' : 'block';
  });

  // Sauvegarde du style en localStorage à chaque modification
  styleMenu.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', () => {
      const style = getCurrentStyle();
      saveStyle(style);
      applyStyleToInput(style);
    });
  });

  const savedStyle = loadSavedStyle();
  applyStyleToInput(savedStyle);
  setInputsFromStyle(savedStyle);

  // Appliquer le style à l'input de message
  function applyStyleToInput(style) {
    if (!messageInput) return;
    messageInput.style.fontWeight = style.bold ? 'bold' : 'normal';
    messageInput.style.fontStyle = style.italic ? 'italic' : 'normal';
    messageInput.style.color = style.color || '#ffffff';
    messageInput.style.fontFamily = style.font || 'Arial, sans-serif';
  }

  // Récupère le style sélectionné dans les inputs
  function getCurrentStyle() {
    return {
      font: styleMenu.querySelector('select[name="font"]').value,
      color: styleMenu.querySelector('input[name="color"]').value,
      bold: styleMenu.querySelector('input[name="bold"]').checked,
      italic: styleMenu.querySelector('input[name="italic"]').checked,
    };
  }

  // Met à jour les inputs du menu avec les données du style
  function setInputsFromStyle(style) {
    if (!style) return;
    styleMenu.querySelector('select[name="font"]').value = style.font || 'Arial, sans-serif';
    styleMenu.querySelector('input[name="color"]').value = style.color || '#ffffff';
    styleMenu.querySelector('input[name="bold"]').checked = style.bold || false;
    styleMenu.querySelector('input[name="italic"]').checked = style.italic || false;
  }

  // Sauvegarde du style en localStorage
  function saveStyle(style) {
    localStorage.setItem('chatStyle', JSON.stringify(style));
  }

  // Exposer à window pour socketHandlers.js si besoin
  window.applyStyleToInput = applyStyleToInput;
}
