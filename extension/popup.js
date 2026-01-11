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

      // Provide more helpful guidance depending on the failure
      const msg = (error && error.message) ? error.message : '';
      if (/Could not establish connection|No active tab|No conversation found/i.test(msg)) {
        showError("Unable to scan conversation. Make sure you're on a supported messaging site (WhatsApp Web, Messenger) and the page is the active tab.");
      } else {
        showError("Unable to scan conversation. " + (msg || 'Please try again.'));
      }

      showScanSection();
    }
  }

  /**
   * Scan conversation messages from content script
   */
  async function scanConversation() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }

        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'scanConversation' },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (response && response.context) {
              resolve(response.context);
            } else {
              reject(new Error('No conversation found'));
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

    const response = await fetch('http://localhost:3001/generate-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: conversation.messages,
        age: conversation.age || 20 // use age if you have it
        })
      });

if (!response.ok) {
  throw new Error('Failed to fetch from backend');
}

const data = await response.json();

// Assuming your backend returns { replies: [recommended, backup1, backup2] }
return {
  recommended: data.replies[0],
  backup1: data.replies[1],
  backup2: data.replies[2]
};

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
            if (response && response.success) {
              showNotification('Reply inserted! ✓');
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
  }

  function showLoading() {
    scanSection.classList.add('hidden');
    loadingState.classList.add('visible');
    resultsSection.classList.remove('visible');
  }

  function showResults() {
    scanSection.classList.add('hidden');
    loadingState.classList.remove('visible');
    resultsSection.classList.add('visible');
  }

  function showError(message) {
    alert(message);
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
