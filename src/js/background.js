// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  // Get current state
  const result = await chrome.storage.local.get(`tab_${tab.id}`);
  const isActive = result[`tab_${tab.id}`] || false;
  
  // Toggle state
  const newState = !isActive;
  await chrome.storage.local.set({ [`tab_${tab.id}`]: newState });
  
  // Update icon opacity based on state
  const iconOpacity = newState ? 255 : 115; // Full opacity when ON, 45% when OFF
  
  try {
    // Create gray-scaled version for inactive state
    const iconData = {
      "16": `icons/icon16.png`,
      "48": `icons/icon48.png`, 
      "128": `icons/icon128.png`
    };
    
    chrome.action.setIcon({
      tabId: tab.id,
      path: iconData
    });
  } catch (e) {
    console.log('Icon update failed:', e);
  }
  
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