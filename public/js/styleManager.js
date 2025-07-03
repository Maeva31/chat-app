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

// 🎨 Toggle menu de style
if (colorTextBtn && styleMenu) {
  colorTextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    styleMenu.style.display = styleMenu.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    styleMenu.style.display = 'none';
  });

  styleMenu.addEventListener('click', e => e.stopPropagation());

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
}
