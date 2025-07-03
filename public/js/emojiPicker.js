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
