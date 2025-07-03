export function initEmojiPicker() {
  const emojiButton = document.getElementById('emoji-button');
  const emojiPicker = document.getElementById('emoji-picker');
  const messageInput = document.getElementById('message-input');

  if (!emojiButton || !emojiPicker || !messageInput) return;

  emojiButton.addEventListener('click', () => {
    emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block';
  });

  emojiPicker.querySelectorAll('.emoji').forEach(emojiSpan => {
    emojiSpan.addEventListener('click', () => {
      messageInput.value += emojiSpan.textContent;
      messageInput.focus();
      emojiPicker.style.display = 'none';  // Fermer après sélection
    });
  });

  // Fermer le picker si clic en dehors
  document.addEventListener('click', (event) => {
    if (
      event.target !== emojiButton &&
      !emojiPicker.contains(event.target)
    ) {
      emojiPicker.style.display = 'none';
    }
  });
}
