import { initUI } from './ui.js';
import { initSocketHandlers } from './socketHandlers.js';
import { initStyleManager } from './styleManager.js';
import { initEmojiPicker } from './emojiPicker.js';
import { initInvisibleMode } from './invisibleMode.js';

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  initStyleManager();
  initEmojiPicker();
  initInvisibleMode();

  initSocketHandlers();
});
