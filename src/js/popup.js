// SVGs for play and stop
const svgPlay = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20 6,4" fill="currentColor"/></svg>`;
const svgStop = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`;

// Default settings
const defaultSettings = {
  units: 'px',
  gridOverlay: false,
  lineColor: '#667eea',
  screenshotFormat: 'png',
  screenshotKey: 'S',
  clearKey: 'Escape'
};

// Check current state when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const toggleBtn = document.getElementById('toggle');
  const toggleText = document.getElementById('toggleText');
  const toggleIcon = document.getElementById('toggleIcon');
  const settingsBtn = document.getElementById('settings');
  const mainPopup = document.getElementById('mainPopup');
  const settingsPanel = document.getElementById('settingsPanel');
  const backBtn = document.getElementById('backBtn');
  
  // Settings controls
  const unitsSelect = document.getElementById('unitsSelect');
  const gridToggle = document.getElementById('gridToggle');
  const lineColor = document.getElementById('lineColor');
  const screenshotFormat = document.getElementById('screenshotFormat');
  const screenshotKey = document.getElementById('screenshotKey');
  const clearKey = document.getElementById('clearKey');
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if content script is available
  const contentScriptAvailable = await checkContentScriptAvailability(tab.id);
  console.log('Content script available:', contentScriptAvailable);
  
  // Get current state
  const result = await chrome.storage.local.get(`tab_${tab.id}`);
  const isActive = result[`tab_${tab.id}`] || false;
  
  // Load settings
  const settings = await loadSettings();
  
  // Update UI
  updateUI(isActive);
  updateSettingsUI(settings);
  
  // Update shortcuts display
  updateShortcutsDisplay(settings);
  
  // Show warning if content script is not available
  if (!contentScriptAvailable) {
    const warning = document.createElement('div');
    warning.style.cssText = `
      background: #fff3cd;
      color: #856404;
      padding: 8px 12px;
      border-radius: 4px;
      margin: 8px 0;
      font-size: 12px;
      border: 1px solid #ffeaa7;
    `;
    warning.textContent = 'SpacePeek may not work on this page. Try refreshing the page.';
    document.querySelector('.container').insertBefore(warning, document.querySelector('.shortcuts'));
  }
  
  // Toggle button click
  toggleBtn.addEventListener('click', async () => {
    try {
      // Always get the latest state from storage
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can inject the content script
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('Cannot inject content script on this page:', tab.url);
        return;
      }
      
      const result = await chrome.storage.local.get(`tab_${tab.id}`);
      const isActive = result[`tab_${tab.id}`] || false;
      const newState = !isActive;

      await chrome.storage.local.set({ [`tab_${tab.id}`]: newState });

      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: newState ? 'enable' : 'disable'
        });
        updateUI(newState);
      } catch (error) {
        console.error('Failed to send message to content script:', error);
        
        // Try to inject the content script if it's not available
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['js/content.js']
          });
          
          // Wait a moment for the script to load, then try again
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, {
                action: newState ? 'enable' : 'disable'
              });
              updateUI(newState);
            } catch (retryError) {
              console.error('Failed to send message after script injection:', retryError);
            }
          }, 100);
        } catch (injectionError) {
          console.error('Failed to inject content script:', injectionError);
          showError('Cannot enable SpacePeek on this page. Try refreshing the page.');
        }
      }
    } catch (error) {
      console.error('Failed to toggle:', error);
      showError('Failed to toggle SpacePeek. Please try again.');
    }
  });
  
  // Settings button click
  settingsBtn.addEventListener('click', () => {
    mainPopup.style.display = 'none';
    settingsPanel.style.display = 'block';
  });
  
  // Back button click
  backBtn.addEventListener('click', () => {
    settingsPanel.style.display = 'none';
    mainPopup.style.display = 'block';
  });
  
  // Settings event listeners
  unitsSelect.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.units = e.target.value;
    await saveSettings(settings);
    console.log('Units changed to:', e.target.value);
    await sendSettingsToContent(tab.id, settings);
  });
  
  gridToggle.addEventListener('click', async () => {
    gridToggle.classList.toggle('active');
    const settings = await loadSettings();
    settings.gridOverlay = gridToggle.classList.contains('active');
    await saveSettings(settings);
    console.log('Grid overlay:', settings.gridOverlay);
    await sendSettingsToContent(tab.id, settings);
  });
  
  // Color picker event listeners
  lineColor.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.lineColor = e.target.value;
    await saveSettings(settings);
    console.log('Line color changed to:', e.target.value);
    await sendSettingsToContent(tab.id, settings);
  });
  
  // Debounced save function for color changes
  let colorSaveTimeout = null;
  const debouncedColorSave = async (colorValue) => {
    if (colorSaveTimeout) {
      clearTimeout(colorSaveTimeout);
    }
    colorSaveTimeout = setTimeout(async () => {
      const settings = await loadSettings();
      settings.lineColor = colorValue;
      await saveSettings(settings);
      console.log('Line color saved (debounced):', colorValue);
      await sendSettingsToContent(tab.id, settings);
    }, 300); // 300ms delay
  };
  
  // Also save on input event for real-time updates
  lineColor.addEventListener('input', (e) => {
    debouncedColorSave(e.target.value);
  });
  
  // Save when color picker loses focus
  lineColor.addEventListener('blur', (e) => {
    debouncedColorSave(e.target.value);
  });
  
  // Save color when popup loses focus (user clicks outside)
  window.addEventListener('blur', async () => {
    // Clear any pending debounced save
    if (colorSaveTimeout) {
      clearTimeout(colorSaveTimeout);
    }
    
    const settings = await loadSettings();
    if (lineColor.value !== settings.lineColor) {
      settings.lineColor = lineColor.value;
      await saveSettings(settings);
      console.log('Line color saved on popup blur:', lineColor.value);
      await sendSettingsToContent(tab.id, settings);
    }
  });
  
  screenshotFormat.addEventListener('change', async (e) => {
    const settings = await loadSettings();
    settings.screenshotFormat = e.target.value;
    await saveSettings(settings);
    console.log('Screenshot format changed to:', e.target.value);
    await sendSettingsToContent(tab.id, settings);
  });
  
  // Shortcut input listeners
  screenshotKey.addEventListener('keydown', async (e) => {
    e.preventDefault();
    const key = e.key === ' ' ? 'Space' : e.key;
    console.log('Screenshot key input - key pressed:', e.key, 'processed as:', key);
    
    screenshotKey.value = key;
    console.log('Screenshot key changed to:', key);
    
    const settings = await loadSettings();
    console.log('Previous settings:', settings);
    settings.screenshotKey = key;
    console.log('Updated settings:', settings);
    
    await saveSettings(settings);
    console.log('Settings saved to storage');
    
    await sendSettingsToContent(tab.id, settings);
    console.log('Settings sent to content script');
    
    updateShortcutsDisplay(settings);
    console.log('Shortcuts display updated');
  });
  
  clearKey.addEventListener('keydown', async (e) => {
    e.preventDefault();
    const key = e.key === ' ' ? 'Space' : e.key;
    console.log('Clear key input - key pressed:', e.key, 'processed as:', key);
    
    clearKey.value = key;
    console.log('Clear key changed to:', key);
    
    const settings = await loadSettings();
    console.log('Previous settings:', settings);
    settings.clearKey = key;
    console.log('Updated settings:', settings);
    
    await saveSettings(settings);
    console.log('Settings saved to storage');
    
    await sendSettingsToContent(tab.id, settings);
    console.log('Settings sent to content script');
    
    updateShortcutsDisplay(settings);
    console.log('Shortcuts display updated');
  });
  
  function updateUI(active) {
    // Update toggle button
    toggleText.textContent = active ? 'Disable' : 'Enable';
    toggleIcon.innerHTML = active ? svgStop : svgPlay;
    
    // Update button styling
    toggleBtn.className = `popup-button ${active ? 'danger' : 'primary'}`;
  }
  
  function updateSettingsUI(settings) {
    // Update form controls
    unitsSelect.value = settings.units;
    gridToggle.classList.toggle('active', settings.gridOverlay);
    lineColor.value = settings.lineColor;
    screenshotFormat.value = settings.screenshotFormat;
    screenshotKey.value = settings.screenshotKey;
    clearKey.value = settings.clearKey;
    
    // Update shortcuts display in main popup
    updateShortcutsDisplay(settings);
  }
  
  async function loadSettings() {
    const result = await chrome.storage.local.get('spacepeek_settings');
    return { ...defaultSettings, ...result.spacepeek_settings };
  }
  
  async function saveSettings(settings) {
    await chrome.storage.local.set({ spacepeek_settings: settings });
  }
  
  async function checkContentScriptAvailability(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return false;
      }
      
      // Try to send a test message
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f8d7da;
      color: #721c24;
      padding: 12px 16px;
      border-radius: 4px;
      border: 1px solid #f5c6cb;
      font-size: 14px;
      z-index: 10000;
      max-width: 300px;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }
  
  function updateShortcutsDisplay(settings) {
    console.log('=== UPDATE SHORTCUTS DISPLAY ===');
    console.log('Settings received:', settings);
    console.log('Screenshot key in settings:', settings.screenshotKey);
    console.log('Clear key in settings:', settings.clearKey);
    
    // Find all shortcut display elements
    const allShortcuts = document.querySelectorAll('.shortcuts .shortcut');
    console.log('Found shortcut elements:', allShortcuts.length);
    
    allShortcuts.forEach((shortcut, index) => {
      const keyElement = shortcut.querySelector('.key');
      const textElement = shortcut.querySelector('span:first-child');
      console.log(`Shortcut ${index + 1}:`, {
        text: textElement ? textElement.textContent : 'No text',
        currentKey: keyElement ? keyElement.textContent : 'No key',
        element: keyElement
      });
    });
    
    // Update screenshot key display in the main popup shortcuts section
    // Note: The first child is h3, so first shortcut is nth-child(2)
    const screenshotKeyDisplay = document.querySelector('.shortcuts .shortcut:nth-child(2) .key');
    if (screenshotKeyDisplay) {
      const newKey = settings.screenshotKey || 'S';
      const oldKey = screenshotKeyDisplay.textContent;
      console.log('Screenshot key display - updating from', oldKey, 'to', newKey);
      screenshotKeyDisplay.textContent = newKey;
      console.log('Screenshot key display updated successfully');
    } else {
      console.log('❌ Screenshot key display element not found');
      console.log('Available elements:', document.querySelectorAll('.shortcuts .shortcut'));
    }
    
    // Update clear key display in the main popup shortcuts section
    // Note: The first child is h3, so second shortcut is nth-child(3)
    const clearKeyDisplay = document.querySelector('.shortcuts .shortcut:nth-child(3) .key');
    if (clearKeyDisplay) {
      const newKey = settings.clearKey || 'Escape';
      const oldKey = clearKeyDisplay.textContent;
      console.log('Clear key display - updating from', oldKey, 'to', newKey);
      clearKeyDisplay.textContent = newKey;
      console.log('Clear key display updated successfully');
    } else {
      console.log('❌ Clear key display element not found');
    }
    
    // Also update the input fields in the settings panel
    const screenshotKeyInput = document.getElementById('screenshotKey');
    if (screenshotKeyInput) {
      const oldValue = screenshotKeyInput.value;
      const newValue = settings.screenshotKey || 'S';
      console.log('Screenshot key input - updating from', oldValue, 'to', newValue);
      screenshotKeyInput.value = newValue;
    } else {
      console.log('❌ Screenshot key input element not found');
    }
    
    const clearKeyInput = document.getElementById('clearKey');
    if (clearKeyInput) {
      const oldValue = clearKeyInput.value;
      const newValue = settings.clearKey || 'Escape';
      console.log('Clear key input - updating from', oldValue, 'to', newValue);
      clearKeyInput.value = newValue;
    } else {
      console.log('❌ Clear key input element not found');
    }
    
    console.log('=== END UPDATE SHORTCUTS DISPLAY ===');
  }
  
  async function sendSettingsToContent(tabId, settings) {
    try {
      // Check if the tab is accessible
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('Cannot send settings to this page:', tab.url);
        return;
      }
      
      await chrome.tabs.sendMessage(tabId, {
        action: 'updateSettings',
        settings: settings
      });
    } catch (error) {
      console.error('Failed to send settings to content script:', error);
      
      // Try to inject the content script if it's not available
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['js/content.js']
        });
        
        // Wait a moment for the script to load, then try again
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, {
              action: 'updateSettings',
              settings: settings
            });
          } catch (retryError) {
            console.error('Failed to send settings after script injection:', retryError);
          }
        }, 100);
      } catch (injectionError) {
        console.error('Failed to inject content script for settings:', injectionError);
      }
    }
  }
  
  // Debug function to test display updates
  window.testDisplayUpdate = function() {
    console.log('=== Testing Display Update ===');
    
    // Test with different settings
    const testSettings = {
      screenshotKey: 'Y',
      clearKey: 'X',
      units: 'px',
      gridOverlay: false,
      lineColor: '#667eea',
      screenshotFormat: 'png'
    };
    
    console.log('Testing with settings:', testSettings);
    updateShortcutsDisplay(testSettings);
    
    // Check what was actually updated
    const screenshotDisplay = document.querySelector('.shortcuts .shortcut:nth-child(2) .key');
    const clearDisplay = document.querySelector('.shortcuts .shortcut:nth-child(3) .key');
    
    console.log('Screenshot display element:', screenshotDisplay);
    console.log('Clear display element:', clearDisplay);
    
    if (screenshotDisplay) {
      console.log('Screenshot display text:', screenshotDisplay.textContent);
    }
    
    if (clearDisplay) {
      console.log('Clear display text:', clearDisplay.textContent);
    }
  };
  
  // Function to check current settings and refresh display
  window.checkAndRefreshSettings = async function() {
    console.log('=== Checking Current Settings ===');
    
    // Load current settings from storage
    const result = await chrome.storage.local.get('spacepeek_settings');
    console.log('Raw storage result:', result);
    
    const currentSettings = { ...defaultSettings, ...result.spacepeek_settings };
    console.log('Current settings:', currentSettings);
    console.log('Screenshot key:', currentSettings.screenshotKey);
    console.log('Clear key:', currentSettings.clearKey);
    
    // Force refresh the display
    console.log('Forcing display refresh...');
    updateShortcutsDisplay(currentSettings);
    
    // Check what's actually displayed
    const screenshotDisplay = document.querySelector('.shortcuts .shortcut:nth-child(2) .key');
    const clearDisplay = document.querySelector('.shortcuts .shortcut:nth-child(3) .key');
    const screenshotInput = document.getElementById('screenshotKey');
    const clearInput = document.getElementById('clearKey');
    
    console.log('=== Current Display State ===');
    console.log('Screenshot display:', screenshotDisplay ? screenshotDisplay.textContent : 'Not found');
    console.log('Clear display:', clearDisplay ? clearDisplay.textContent : 'Not found');
    console.log('Screenshot input:', screenshotInput ? screenshotInput.value : 'Not found');
    console.log('Clear input:', clearInput ? clearInput.value : 'Not found');
    
    return currentSettings;
  };
}); 