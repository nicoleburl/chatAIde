/**
 * Handles text selection and communication with popup
 */

(function() {
  'use strict';

  let selectedText = '';

  // Listen for text selection
  document.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    selectedText = selection.toString().trim();
  });

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // EXISTING: get selected text
    if (request.action === 'getSelectedText') {
      sendResponse({ text: selectedText });
      return;
    }

    // ✅ NEW: scanConversation (used by popup.js)
    if (request.action === 'scanConversation') {
      if (!selectedText) {
        sendResponse({ context: null });
        return;
      }

      // Simple parsing: split into messages
      const messages = selectedText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      sendResponse({
        context: {
          messages,
          tone: detectTone(selectedText),
          hasEmojis: /[\u{1F300}-\u{1FAFF}]/u.test(selectedText),
          isQuestion: selectedText.includes('?')
        }
      });
    }
  });

  // Very basic tone detection (good enough for demo)
  function detectTone(text) {
    if (/lol|haha|omg|yeah|nah|btw/i.test(text)) return 'casual';
    if (/thank you|regards|sincerely/i.test(text)) return 'formal';
    if (/!{2,}|😍|🎉|🔥/.test(text)) return 'enthusiastic';
    return 'neutral';
  }

  console.log('Conversational Aide content script loaded');
})();
