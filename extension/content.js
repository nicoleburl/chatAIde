
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
        const selectorCounts = {
          whatsapp: document.querySelectorAll('span.selectable-text, div.copyable-text, [data-testid^="msg-"]').length,
          messenger: document.querySelectorAll('[data-testid="message-text"], [data-testid^="msg"]').length,
          generic: document.querySelectorAll('div, span, p').length
        };

        const debug = {
          site,
          url: window.location.href,
          messageCount: messages.length,
          sample: messages.slice(0, 5),
          selectorCounts
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
            if (el && el.offsetParent !== null) return { el, selector: sel };
          }
          return null;
        };

        // Site-specific insertion order
        const hostname = (window.location.hostname || '');
        const site = hostname.includes('web.whatsapp.com') ? 'whatsapp' : (hostname.includes('messenger.com') || hostname.includes('facebook.com')) ? 'messenger' : 'other';

        let tryResult = null;
        if (site === 'whatsapp') {
          // WhatsApp has multiple contenteditable areas (search, chat input). Prefer the chat input in the footer
          const candidates = Array.from(document.querySelectorAll('div[contenteditable="true"], textarea'))
            .filter(el => el && el.offsetParent !== null);

          // Heuristics to prefer the message input:
          const preferred = candidates.filter(el => {
            // If it's inside a footer area it's very likely the chat input
            if (el.closest('footer')) return true;

            // If attributes contain 'message' or 'type a message' it's likely the chat composer
            const title = (el.getAttribute('title') || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (/message/.test(title) || /message/.test(aria) || /type a message/.test(aria)) return true;

            // Exclude obvious search fields: elements under header or search containers
            if (el.closest('header') || el.closest('[role="search"]') || el.closest('.app-search') || el.closest('.chat-search')) return false;

            return false;
          });

          if (preferred.length) {
            // Choose the last preferred input (most recent / bottom of DOM)
            const el = preferred[preferred.length - 1];
            tryResult = { el, selector: 'whatsapp-preferred' };
          } else if (candidates.length) {
            // Fallback to last visible contenteditable
            const el = candidates[candidates.length - 1];
            tryResult = { el, selector: 'whatsapp-fallback' };
          } else {
            tryResult = null;
          }
        } else if (site === 'messenger') {
          tryResult = trySelectors(['div[role="textbox"][contenteditable="true"]', 'div[contenteditable="true"]', 'textarea']);
        } else {
          tryResult = trySelectors(['div[contenteditable="true"]', 'textarea', 'input[type="text"]']);
        }

        const debugBase = { site, selector: tryResult ? tryResult.selector : null, url: window.location.href };

        if (!tryResult) {
          console.warn('No chat input found to insert reply', debugBase);
          sendResponse({ success: false, debug: Object.assign({ error: 'no_input' }, debugBase) });
          return;
        }

        const input = tryResult.el;
        try {
          input.focus();
        } catch (e) {
          // ignoring focus errors
        }

        const setCaretToEnd = (el) => {
          try {
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          } catch (e) {
            // ignore
          }
        };

        const dispatchInputEvents = (el, txt) => {
          try {
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
          } catch (e) {
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        // Attempt multiple strategies, gather debug information about each
        const debug = Object.assign({}, debugBase);
        let inserted = false;

        if (input.isContentEditable) {
          debug.attempts = debug.attempts || [];

          // 1) Try execCommand insertText
          try {
            const ok = document.execCommand('insertText', false, text);
            debug.attempts.push({ method: 'execCommand', result: ok });
            setCaretToEnd(input);
            dispatchInputEvents(input, text);
            const content = (input.innerText || input.textContent || '').trim();
            debug.postExec = content;
            if (content && (content.includes(text) || content === text)) {
              inserted = true;
            }
          } catch (e) {
            debug.attempts.push({ method: 'execCommand', error: String(e) });
          }

          // 2) Try direct node replacement (single text node or textContent)
          if (!inserted) {
            try {
              if (input.childNodes.length === 1 && input.childNodes[0].nodeType === Node.TEXT_NODE) {
                input.childNodes[0].nodeValue = text;
                debug.attempts.push({ method: 'singleTextNodeReplace' });
              } else {
                input.textContent = text;
                debug.attempts.push({ method: 'textContentReplace' });
              }

              setCaretToEnd(input);
              dispatchInputEvents(input, text);

              const content2 = (input.innerText || input.textContent || '').trim();
              debug.postReplace = content2;
              if (content2 && (content2.includes(text) || content2 === text)) {
                inserted = true;
              }
            } catch (e) {
              debug.attempts.push({ method: 'replace', error: String(e) });
            }
          }

          // 3) Try range insert
          if (!inserted) {
            try {
              const range = document.createRange();
              range.selectNodeContents(input);
              range.deleteContents();
              range.insertNode(document.createTextNode(text));
              debug.attempts.push({ method: 'rangeInsert' });

              setCaretToEnd(input);
              dispatchInputEvents(input, text);

              const content3 = (input.innerText || input.textContent || '').trim();
              debug.postRange = content3;
              if (content3 && (content3.includes(text) || content3 === text)) {
                inserted = true;
              }
            } catch (e) {
              debug.attempts.push({ method: 'rangeInsert', error: String(e) });
            }
          }

          // 4) Final verification and response
          debug.finalContent = (input.innerText || input.textContent || '').trim();
          if (inserted) {
            console.log('Insert succeeded', debug);
            sendResponse({ success: true });
            return;
          } else {
            console.warn('Insert verification failed for contenteditable', debug);
            sendResponse({ success: false, debug });
            return;
          }
        } else {
          // Standard input/textarea
          try {
            input.value = text;
            dispatchInputEvents(input, text);
            debug.finalValue = input.value;
            if (input.value === text) {
              console.log('Input value set successfully', debug);
              sendResponse({ success: true });
              return;
            } else {
              console.warn('Insertion verification failed for input/textarea', debug);
              sendResponse({ success: false, debug });
              return;
            }
          } catch (e) {
            console.error('Failed setting value on input:', e, debug);
            sendResponse({ success: false, debug: Object.assign(debug, { error: String(e) }) });
            return;
          }
        }
      } catch (err) {
        console.error('Insert failed unexpected:', err);
        sendResponse({ success: false, debug: { error: err && err.message ? err.message : String(err) } });
      }

      return;
    }
  });

  console.log('Conversational Aide content script loaded - enhanced');
})();
