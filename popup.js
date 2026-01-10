/**
 * Conversational Aide - Popup Script
 * Handles user interaction, API communication, and response rendering
 */

(function() {
  'use strict';

  // State
  let selectedTone = 'calm';
  let currentRequest = null;

  // DOM Elements
  const selectedTextArea = document.getElementById('selected-text');
  const personaTextArea = document.getElementById('persona-text');
  const personaToggle = document.getElementById('persona-toggle');
  const personaContent = document.getElementById('persona-content');
  const generateBtn = document.getElementById('generate-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const loadingState = document.getElementById('loading-state');
  const resultsSection = document.getElementById('results-section');
  const optionsContainer = document.getElementById('options-container');
  const toneBtns = document.querySelectorAll('.tone-btn');

  // Initialize
  init();

  function init() {
    // Step 2: Auto-populate with selected text from page
    retrieveSelectedText();
    
    // Setup event listeners
    setupEventListeners();
  }

  /**
   * Step 2: Retrieve selected text from content script
   */
  function retrieveSelectedText() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'getSelectedText' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.log('Content script not ready:', chrome.runtime.lastError.message);
              return;
            }
            
            if (response && response.text) {
              selectedTextArea.value = response.text;
              selectedTextArea.focus();
            }
          }
        );
      }
    });
  }

  /**
   * Setup all event listeners
   */
  function setupEventListeners() {
    // Persona section toggle
    personaToggle.addEventListener('click', () => {
      const parent = personaToggle.closest('.collapsible');
      parent.classList.toggle('open');
    });

    // Tone selection (Step 4)
    toneBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toneBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTone = btn.dataset.tone;
      });
    });

    // Generate button (Step 5)
    generateBtn.addEventListener('click', handleGenerate);

    // Regenerate button
    regenerateBtn.addEventListener('click', handleGenerate);
  }

  /**
   * Step 5: Handle generate/regenerate request
   */
  async function handleGenerate() {
    const messageText = selectedTextArea.value.trim();
    
    // Validation
    if (!messageText) {
      showError('Please enter or select some text to rewrite.');
      return;
    }

    // Prepare request data
    currentRequest = {
      message: messageText,
      persona: personaTextArea.value.trim() || null,
      tone: selectedTone,
      timestamp: Date.now()
    };

    // Show loading state
    showLoading();

    try {
      // Step 5: Send to backend
      const response = await sendToBackend(currentRequest);
      
      // Step 6: Display results
      displayResults(response.options);
      
    } catch (error) {
      console.error('Generation error:', error);
      showError('Unable to generate options. Please try again.');
      hideLoading();
    }
  }

  /**
   * Step 5: Send structured request to backend
   * In production, replace with actual API endpoint
   */
  async function sendToBackend(requestData) {
    // Simulate API call with delay
    await delay(1500);

    // Simulated backend response
    // In production, replace with: 
    // const response = await fetch('YOUR_API_ENDPOINT', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(requestData)
    // });
    // return await response.json();

    return generateMockResponse(requestData);
  }

  /**
   * Step 6: Display response options
   */
  function displayResults(options) {
    hideLoading();
    
    // Clear previous results
    optionsContainer.innerHTML = '';
    
    // Create option cards
    options.forEach((option, index) => {
      const card = createOptionCard(option, index + 1);
      optionsContainer.appendChild(card);
    });
    
    // Show results section
    resultsSection.classList.add('visible');
  }

  /**
   * Create an individual option card (Step 6)
   */
  function createOptionCard(optionText, index) {
    const card = document.createElement('div');
    card.className = 'option-card';
    
    card.innerHTML = `
      <div class="option-header">
        <span class="option-label">Option ${index}</span>
        <span class="copy-indicator">Copied!</span>
      </div>
      <div class="option-text">${escapeHtml(optionText)}</div>
    `;

    // Step 7: Copy to clipboard on click
    card.addEventListener('click', () => {
      copyToClipboard(optionText, card);
    });

    return card;
  }

  /**
   * Step 7: Copy text to clipboard
   */
  function copyToClipboard(text, cardElement) {
    navigator.clipboard.writeText(text).then(() => {
      // Show copied indicator
      const indicator = cardElement.querySelector('.copy-indicator');
      indicator.classList.add('visible');
      
      // Visual feedback
      cardElement.style.borderColor = '#4ade80';
      
      setTimeout(() => {
        indicator.classList.remove('visible');
        cardElement.style.borderColor = '';
      }, 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      showError('Failed to copy to clipboard');
    });
  }

  /**
   * UI State Management
   */
  function showLoading() {
    generateBtn.disabled = true;
    loadingState.classList.add('visible');
    resultsSection.classList.remove('visible');
  }

  function hideLoading() {
    generateBtn.disabled = false;
    loadingState.classList.remove('visible');
  }

  function showError(message) {
    // Simple error display - can be enhanced with a toast/notification
    alert(message);
  }

  /**
   * Utility Functions
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Mock Response Generator
   * Replace this entire function with actual backend API in production
   */
  function generateMockResponse(requestData) {
    const { message, tone, persona } = requestData;
    
    // Generate 3 variations based on tone
    const toneVariations = {
      calm: {
        prefix: "I wanted to share that",
        style: "gentle and measured"
      },
      direct: {
        prefix: "Here's what I need to say:",
        style: "clear and straightforward"
      },
      friendly: {
        prefix: "Hey! Just wanted to mention",
        style: "warm and approachable"
      },
      respectful: {
        prefix: "I'd like to respectfully share",
        style: "considerate and thoughtful"
      }
    };

    const variation = toneVariations[tone] || toneVariations.calm;
    
    // Generate 3 options
    const options = [
      `${variation.prefix} ${message.toLowerCase()}. I appreciate your understanding on this.`,
      `${message.charAt(0).toUpperCase() + message.slice(1)}. I wanted to make sure we're on the same page about this.`,
      `Just wanted to reach out about this: ${message.toLowerCase()}. Let me know if you have any questions.`
    ];

    // If persona provided, add note about style matching
    const personaNote = persona ? " (adapted to match your writing style)" : "";

    return {
      options: options,
      metadata: {
        tone: tone,
        hasPersona: !!persona,
        note: `Generated with ${variation.style} tone${personaNote}`
      }
    };
  }

})();