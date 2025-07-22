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

  if (request.action === 'test') {
    sendResponse({ success: true, message: 'Background script is working' });
    return true;
  }

  // Handle screenshot request
  if (request.action === 'captureScreenshot') {
    // Get settings for screenshot format
    chrome.storage.local.get('spacepeek_settings', (result) => {
      const settings = result.spacepeek_settings || { screenshotFormat: 'png' };
      const format = settings.screenshotFormat || 'png';
      
      // Check if we can capture this tab
      chrome.tabs.get(sender.tab.id, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Tab access error:', chrome.runtime.lastError);
          sendResponse({ error: 'Cannot access tab: ' + chrome.runtime.lastError.message });
          return;
        }
        
        // Check if tab URL is allowed for screenshots
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
          console.error('Cannot capture screenshot of chrome:// or chrome-extension:// pages');
          sendResponse({ error: 'Cannot capture screenshots of browser pages' });
          return;
        }
        
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: format }, (dataUrl) => {
          if (chrome.runtime.lastError) {
            console.error('Screenshot error:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else if (!dataUrl) {
            console.error('Screenshot returned no data');
            sendResponse({ error: 'Screenshot failed - no data received' });
          } else {
            // Try to save using downloads API as fallback
            try {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
              const filename = `spacepeek-screenshot-${timestamp}.${format}`;
              
              chrome.downloads.download({
                url: dataUrl,
                filename: filename,
                saveAs: false
              }, (downloadId) => {
                if (chrome.runtime.lastError) {
                  sendResponse({ dataUrl, format });
                } else {
                  sendResponse({ success: true, downloadId, format });
                }
              });
            } catch (error) {
              sendResponse({ dataUrl, format });
            }
          }
        });
      });
    });
    return true; // Keep message channel open for async response
  }
}); 