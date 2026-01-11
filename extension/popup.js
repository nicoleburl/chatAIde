/**
 * ChatAIde - Popup Script
 * Manages UI flow and backend communication
 */

(function() {
  'use strict';

  // State
  let currentConversation = null;
  let currentReplies = null;

  // DOM Elements
  const scanSection = document.getElementById('scan-section');
  const loadingState = document.getElementById('loading-state');
  const resultsSection = document.getElementById('results-section');
  const scanBtn = document.getElementById('scan-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const newScanBtn = document.getElementById('new-scan-btn');
  const toggleBtn = document.getElementById('toggle-view-btn');
  
  // Reply text elements
  const recommendedText = document.getElementById('recommended-text');
  const backupText1 = document.getElementById('backup-text-1');
  const backupText2 = document.getElementById('backup-text-2');

  // Error box in-popup
  const errorBox = document.getElementById('error-box');
  const errorMessageEl = document.getElementById('error-message');
  const errorToggleBtn = document.getElementById('error-toggle-btn');
  const errorCopyBtn = document.getElementById('error-copy-btn');
  const errorDetailsPre = document.getElementById('error-details');

  // Initialize
  init();

  function init() {
    setupEventListeners();
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Main scan button
    scanBtn.addEventListener('click', handleScanAndGenerate);
    
    // Bottom action buttons
    regenerateBtn.addEventListener('click', handleRegenerate);
    newScanBtn.addEventListener('click', handleNewScan);

    // Toggle view (demo)
    if (toggleBtn) toggleBtn.addEventListener('click', handleToggleView);

    // Copy and insert buttons (delegated)
    resultsSection.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('.copy-btn');
      const insertBtn = e.target.closest('.insert-btn');
      
      if (copyBtn) {
        const replyType = copyBtn.dataset.reply;
        handleCopy(replyType, copyBtn);
      }
      
      if (insertBtn) {
        const replyType = insertBtn.dataset.reply;
        handleInsert(replyType);
      }
    });

    // Error box toggle & copy handlers
    if (errorToggleBtn) {
      errorToggleBtn.addEventListener('click', () => {
        const isVisible = errorDetailsPre && errorDetailsPre.style.display === 'block';
        if (isVisible) {
          errorDetailsPre.style.display = 'none';
          errorDetailsPre.setAttribute('aria-hidden', 'true');
          errorToggleBtn.textContent = 'Show details';
        } else {
          if (errorDetailsPre) {
            errorDetailsPre.style.display = 'block';
            errorDetailsPre.setAttribute('aria-hidden', 'false');
            errorToggleBtn.textContent = 'Hide details';
          }
        }
      });
    }

    if (errorCopyBtn) {
      errorCopyBtn.addEventListener('click', () => {
        if (!errorDetailsPre || !errorDetailsPre.textContent) return;
        navigator.clipboard.writeText(errorDetailsPre.textContent).then(() => {
          const original = errorCopyBtn.textContent;
          errorCopyBtn.textContent = 'Copied!';
          setTimeout(() => errorCopyBtn.textContent = original, 1400);
        }).catch(() => {
          // ignore copy errors
        });
      });
    }
  }

  /**
   * Main flow: Scan conversation and generate replies
   */
  async function handleScanAndGenerate() {
    showLoading();

    try {
      // Step 1: Scan conversation from WhatsApp/Messenger
      const conversation = await scanConversation();
      currentConversation = conversation;

      // Step 2: Send to backend AI to generate replies
      const replies = await generateReplies(conversation);
      currentReplies = replies;

      // Step 3: Display the 3 replies
      displayReplies(replies);

    } catch (error) {
      console.error('Error:', error);

      // Provide more helpful guidance depending on the failure and include debug details
      const msg = (error && error.message) ? error.message : '';
      let friendly = "Unable to scan conversation.";
      if (/Could not establish connection|No active tab|No conversation found/i.test(msg)) {
        friendly = "Unable to scan conversation. Make sure you're on a supported messaging site (WhatsApp Web, Messenger) and the page is the active tab.";
      } else if (/inject|content script/i.test(msg)) {
        friendly = "Failed to inject the content script into the page. This may be caused by page restrictions or a site that blocks scripts.";
      } else if (/Failed to fetch from backend/i.test(msg)) {
        friendly = "The backend failed to generate replies. Check that the AI server is running.";
      } else {
        friendly = "Unable to scan conversation. " + (msg || 'Please try again.');
      }

      // Pass along structured debug details if available
      showError(friendly, error && error.debug ? error.debug : { message: msg });

      showScanSection();
    }
  }

  /**
   * Scan conversation messages from content script
   */
  async function ensureContentScript(tabId) {
    return new Promise((resolve, reject) => {
      try {
        if (!chrome.scripting || !chrome.scripting.executeScript) {
          // Older Manifest v2 or no scripting API available
          resolve();
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, (results) => {
          if (chrome.runtime.lastError) {
            const err = new Error('Failed to inject content script: ' + chrome.runtime.lastError.message);
            err.debug = { lastError: chrome.runtime.lastError.message };
            reject(err);
            return;
          }

          resolve();
        });
      } catch (err) {
        // If scripting API isn't available, proceed and let sendMessage fail gracefully
        console.warn('ensureContentScript warning:', err);
        resolve();
      }
    });
  }

  async function scanConversation() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }

        try {
          // Try to inject content script to ensure message receiver exists
          await ensureContentScript(tabs[0].id);
        } catch (injectErr) {
          // If injection failed, include this in the error to show to the user
          const e = new Error('Failed to ensure content script is present');
          e.debug = { injectErr: injectErr && (injectErr.message || String(injectErr)) };
          reject(e);
          return;
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'scanConversation' },
          (response) => {
            if (chrome.runtime.lastError) {
              const e = new Error('Chrome runtime error when messaging tab: ' + chrome.runtime.lastError.message);
              e.debug = { lastError: chrome.runtime.lastError.message };
              reject(e);
              return;
            }

            if (response && response.context) {
              resolve(response.context);
            } else if (response && response.debug) {
              // Content script responded but didn't find messages — include debug object
              const e = new Error('No conversation found on page');
              e.debug = response.debug;
              reject(e);
            } else {
              const e = new Error('No conversation found');
              reject(e);
            }
          }
        );
      });
    });
  }

  /**
   * Send conversation to backend and get 3 replies
   * This is where you'll integrate your AI backend
   */
  async function generateReplies(conversation) {
    // Simulate API delay
    await delay(2000);

    // Try multiple ports in case the backend retried to a different port (5000..5005)
    const ports = [5000, 5001, 5002, 5003, 5004, 5005];

    // Helper to timeout fetch quickly if the port isn't responding
    const fetchWithTimeout = (url, options, timeout = 2000) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout))
      ]);
    };

    let lastError = null;

    for (const port of ports) {
      const url = `http://localhost:${port}/generate-replies`;
      try {
        const response = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: conversation.messages, age: conversation.age || 20 })
        }, 2000);

        if (!response.ok) {
          lastError = new Error(`Backend responded with ${response.status} on port ${port}`);
          continue;
        }

        const data = await response.json();

        // Assuming your backend returns { replies: [recommended, backup1, backup2] }
        return {
          recommended: data.replies[0],
          backup1: data.replies[1],
          backup2: data.replies[2]
        };
      } catch (err) {
        // keep trying other ports
        lastError = err;
      }
    }

    // If none of the ports worked, fall back to local mock replies (graceful degradation)
    console.warn('Backend unreachable, falling back to local mock replies', lastError);
    try {
      showNotification('Backend unavailable — using local fallback replies');
    } catch (nErr) {
      // showNotification may not be available in some contexts; ignore
    }

    return generateMockReplies(conversation);
  }

  /**
   * Display the 3 generated replies
   */
  function displayReplies(replies) {
    // Set reply texts
    recommendedText.textContent = replies.recommended;
    backupText1.textContent = replies.backup1;
    backupText2.textContent = replies.backup2;

    // Show results
    showResults();
  }

  /**
   * Handle copy to clipboard
   */
  function handleCopy(replyType, button) {
    let text = '';
    
    if (replyType === 'recommended') {
      text = recommendedText.textContent;
    } else if (replyType === 'backup-1') {
      text = backupText1.textContent;
    } else if (replyType === 'backup-2') {
      text = backupText2.textContent;
    }

    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback
      const originalText = button.innerHTML;
      button.classList.add('copied');
      button.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!';
      
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      showError('Failed to copy to clipboard');
    });
  }

  /**
   * Handle insert into chat input field
   */
  function handleInsert(replyType) {
    let text = '';
    
    if (replyType === 'recommended') {
      text = recommendedText.textContent;
    } else if (replyType === 'backup-1') {
      text = backupText1.textContent;
    } else if (replyType === 'backup-2') {
      text = backupText2.textContent;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'insertReply', text: text },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Insert reply messaging error:', chrome.runtime.lastError.message);
              showError('Failed to insert reply', { chromeError: chrome.runtime.lastError.message });
              return;
            }

            if (response && response.success) {
              showNotification('Reply inserted! ✓');
            } else {
              console.warn('Insert reply failed or was not verified by content script', response);
              const debug = response && response.debug ? response.debug : { message: 'Insertion failed' };
              debug.suggestion = 'Open the messaging page console (DevTools) and look for insertion logs';
              showError('Failed to insert reply', debug);
            }
          }
        );
      }
    });
  }

  /**
   * Regenerate replies with same conversation
   */
  async function handleRegenerate() {
    if (!currentConversation) return;

    showLoading();

    try {
      const replies = await generateReplies(currentConversation);
      currentReplies = replies;
      displayReplies(replies);
    } catch (error) {
      console.error('Regeneration error:', error);
      showError('Failed to regenerate replies');
      showResults();
    }
  }

  /**
   * Start new scan
   */
  function handleNewScan() {
    currentConversation = null;
    currentReplies = null;
    showScanSection();
  }

  /**
   * UI State Management
   */
  function showScanSection() {
    scanSection.classList.remove('hidden');
    loadingState.classList.remove('visible');
    resultsSection.classList.remove('visible');
    if (errorBox) {
      errorBox.classList.remove('visible');
      errorBox.setAttribute('aria-hidden', 'true');
      errorBox.textContent = '';
    }
  }

  function showLoading() {
    scanSection.classList.add('hidden');
    loadingState.classList.add('visible');
    resultsSection.classList.remove('visible');
    if (errorBox) {
      errorBox.classList.remove('visible');
      errorBox.setAttribute('aria-hidden', 'true');
      errorBox.textContent = '';
    }
  }

  function showResults() {
    scanSection.classList.add('hidden');
    loadingState.classList.remove('visible');
    resultsSection.classList.add('visible');
    if (errorBox) {
      errorBox.classList.remove('visible');
      errorBox.setAttribute('aria-hidden', 'true');
      errorBox.textContent = '';
    }
  }

  function showError(message, details) {
    console.warn('Popup error:', message, details);

    // Render message into the in-popup error box if available
    if (errorBox && errorMessageEl) {
      // main message
      errorMessageEl.textContent = message;

      // details (if any)
      if (details) {
        try {
          errorDetailsPre.textContent = typeof details === 'string' ? details : JSON.stringify(details, null, 2);
        } catch (e) {
          errorDetailsPre.textContent = String(details);
        }
        if (errorToggleBtn) errorToggleBtn.style.display = 'inline-block';
        if (errorCopyBtn) errorCopyBtn.style.display = 'inline-block';
      } else {
        if (errorDetailsPre) {
          errorDetailsPre.textContent = '';
          errorDetailsPre.style.display = 'none';
          errorDetailsPre.setAttribute('aria-hidden', 'true');
        }
        if (errorToggleBtn) errorToggleBtn.style.display = 'none';
        if (errorCopyBtn) errorCopyBtn.style.display = 'none';
      }

      // show the box and collapse details initially
      errorBox.classList.add('visible');
      errorBox.setAttribute('aria-hidden', 'false');
      if (errorDetailsPre) {
        errorDetailsPre.style.display = 'none';
        errorDetailsPre.setAttribute('aria-hidden', 'true');
      }
      if (errorToggleBtn) errorToggleBtn.textContent = 'Show details';
    } else {
      // fallback to alert when UI not available
      alert(message + (details ? '\n\nDetails:\n' + (typeof details === 'string' ? details : JSON.stringify(details, null, 2)) : ''));
    }
  }

  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4ade80;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  function handleToggleView() {
    if (scanSection.classList.contains('hidden')) {
      showScanSection();
    } else {
      showResults();
    }
  }

  /**
   * Utility
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mock Reply Generator
   * REMOVE THIS ENTIRE FUNCTION IN PRODUCTION
   * Replace with actual backend API call
   */
  function generateMockReplies(conversation) {
    const { tone, hasEmojis } = conversation;

    // Generate based on detected tone
    const toneReplies = {
      casual: {
        recommended: "yeah totally! sounds good to me",
        backup1: "for sure! i'm down",
        backup2: "yeah definitely 👍"
      },
      formal: {
        recommended: "Thank you for reaching out. I'd be happy to help with that.",
        backup1: "I appreciate you letting me know. I'll take care of this.",
        backup2: "Thanks for the update. I'll follow up shortly."
      },
      enthusiastic: {
        recommended: "omg yes!! that sounds amazing! 🎉",
        backup1: "absolutely!! i'm so excited about this!",
        backup2: "yes yes yes! can't wait!!"
      },
      neutral: {
        recommended: "Got it, thanks for letting me know.",
        backup1: "Understood. I'll look into this.",
        backup2: "Thanks for the heads up."
      }
    };

    const selectedReplies = toneReplies[tone] || toneReplies.neutral;

    return {
      recommended: selectedReplies.recommended,
      backup1: selectedReplies.backup1,
      backup2: selectedReplies.backup2
    };
  }

})();
