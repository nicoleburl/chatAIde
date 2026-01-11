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
    // Return selected text (existing feature)
    if (request.action === 'getSelectedText') {
      sendResponse({ text: selectedText });
      return;
    }

    // Scan conversation: collect last visible text nodes as messages
    if (request.action === 'scanConversation') {
      try {
        const detectSite = () => {
          const host = window.location.hostname || '';
          if (host.includes('web.whatsapp.com')) return 'whatsapp';
          if (host.includes('messenger.com') || host.includes('facebook.com')) return 'messenger';
          return 'other';
        };

        const detectTone = (joined) => {
          const hasEmojis = /[\u{1F600}-\u{1F6FF}\u{2700}-\u{27BF}]/u.test(joined);
          let tone = 'neutral';

          if (/[!]{2,}|\b(omg|wow|yay)\b/i.test(joined) || hasEmojis) tone = 'enthusiastic';
          else if (/\b(lol|haha|haha)\b/i.test(joined)) tone = 'casual';
          else if (/\b(thank you|regards|sincerely)\b/i.test(joined)) tone = 'formal';

          return { tone, hasEmojis };
        };

        const parseWhatsApp = () => {
          // WhatsApp Web commonly uses 'span.selectable-text' for message text
          const nodes = Array.from(document.querySelectorAll('span.selectable-text, div.copyable-text, [data-testid^="msg-"], .message-in, .message-out'));
          const texts = nodes
            .filter(n => n && n.innerText && n.offsetParent !== null)
            .map(n => n.innerText.trim())
            .filter(Boolean);

          // Often messages include metadata, split newlines
          const msgs = texts.map(t => t.split('\n').map(s => s.trim()).filter(Boolean)).flat();
          return msgs.slice(-10);
        };

        const parseMessenger = () => {
          // Messenger often has data-testid="message-text"
          const nodes = Array.from(document.querySelectorAll('[data-testid="message-text"], [data-testid^="msg"]'));
          const texts = nodes
            .filter(n => n && n.innerText && n.offsetParent !== null)
            .map(n => n.innerText.trim())
            .filter(Boolean);

          const msgs = texts.map(t => t.split('\n').map(s => s.trim()).filter(Boolean)).flat();
          return msgs.slice(-10);
        };

        const parseGeneric = () => {
          const candidates = Array.from(document.querySelectorAll('div, span, p'))
            .filter(el => {
              const text = el.innerText && el.innerText.trim();
              return text && el.offsetParent !== null && !el.matches('script, style, [contenteditable]');
            })
            .map(el => el.innerText.trim());

          const deduped = Array.from(new Set(candidates)).slice(-30);
          const msgs = deduped.map(t => t.split('\n').map(s => s.trim()).filter(Boolean)).flat();
          return msgs.slice(-10);
        };

        const site = detectSite();
        let messages = [];

        if (site === 'whatsapp') {
          messages = parseWhatsApp();
          console.log('Detected WhatsApp Web; messages found:', messages.length);
        } else if (site === 'messenger') {
          messages = parseMessenger();
          console.log('Detected Messenger; messages found:', messages.length);
        }

        // Fallback to generic parsing if site-specific returned nothing
        if (!messages || messages.length === 0) {
          messages = parseGeneric();
          console.log('Used generic parser; messages found:', messages.length);
        }

        const joined = messages.join(' ');
        const { tone, hasEmojis } = detectTone(joined);

        // Build debug info to aid diagnostics
        const debug = {
          site,
          messageCount: messages.length,
          sample: messages.slice(0, 5)
        };

        console.log('Scan result debug:', debug);

        // Package messages in expected shape and include debug info
        sendResponse({ context: { messages: messages.map(m => ({ text: m })), tone, hasEmojis }, debug });
      } catch (err) {
        console.error('Scan failed:', err);
        // Include error details in debug payload
        sendResponse({ debug: { error: err && err.message ? err.message : String(err) } });
      }

      return; // keep synchronous response
    }

    // Insert reply text into the chat input (supporting site-specific selectors)
    if (request.action === 'insertReply') {
      try {
        const text = request.text || '';

        const trySelectors = (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) return el;
          }
          return null;
        };

        // Site-specific insertion order
        const site = (window.location.hostname || '').includes('web.whatsapp.com') ? 'whatsapp' : ((window.location.hostname || '').includes('messenger.com') || (window.location.hostname || '').includes('facebook.com')) ? 'messenger' : 'other';

        let input = null;
        if (site === 'whatsapp') {
          input = trySelectors(['div[contenteditable="true"][data-tab]', 'div[contenteditable="true"]', 'textarea']);
        } else if (site === 'messenger') {
          input = trySelectors(['div[role="textbox"][contenteditable="true"]', 'div[contenteditable="true"]', 'textarea']);
        } else {
          input = trySelectors(['div[contenteditable="true"]', 'textarea', 'input[type="text"]']);
        }

        if (input) {
          input.focus();

          if (input.isContentEditable) {
            // Try using execCommand for better compatibility with React-managed inputs
            try {
              document.execCommand('selectAll', false, null);
              document.execCommand('insertText', false, text);
            } catch (e) {
              // Fallback to replacing text nodes
              const range = document.createRange();
              range.selectNodeContents(input);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
            }

            // Dispatch events so frameworks detect the change
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }

          sendResponse({ success: true });
        } else {
          console.warn('No chat input found to insert reply');
          sendResponse({ success: false });
        }
      } catch (err) {
        console.error('Insert failed:', err);
        sendResponse({ success: false });
      }

      return;
    }
  });

  console.log('Conversational Aide content script loaded - enhanced');
})();
