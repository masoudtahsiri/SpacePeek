// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  // Get current state
  const result = await chrome.storage.local.get(`tab_${tab.id}`);
  const isActive = result[`tab_${tab.id}`] || false;
  
  // Toggle state
  const newState = !isActive;
  await chrome.storage.local.set({ [`tab_${tab.id}`]: newState });
  
  // Icon state will be managed by the default icon in manifest.json
  // Dynamic icon changes removed to prevent fetch errors
  
  // Send message to content script
  try {
    chrome.tabs.sendMessage(tab.id, {
      action: newState ? 'enable' : 'disable'
    });
  } catch (e) {
    console.log('Failed to send message to content script:', e);
  }
});

// Clean up when tab closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await chrome.storage.local.remove(`tab_${tabId}`);
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getState') {
    chrome.storage.local.get(`tab_${sender.tab.id}`, (result) => {
      sendResponse({ isActive: result[`tab_${sender.tab.id}`] || false });
    });
    return true; // Keep message channel open for async response
  }
}); 