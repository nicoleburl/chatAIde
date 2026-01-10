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
    if (request.action === 'getSelectedText') {
      sendResponse({ text: selectedText });
    }
  });

  console.log('Conversational Aide content script loaded');
})();