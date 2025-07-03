import { initUI } from './ui.js';
import { initSocketHandlers } from './socketHandlers.js';
import { initStyleManager } from './styleManager.js';
import { initEmojiPicker } from './emojiPicker.js';
import { initInvisibleMode } from './invisibleMode.js';
import { addMessageToChat } from './chatUtils.js';




document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initStyleManager();
  initEmojiPicker();
  initInvisibleMode();

  initSocketHandlers();
});
