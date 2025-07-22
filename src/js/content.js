// Check if content script is already running
if (window.spacepeekInitialized) {
  // Exit early to prevent multiple instances
} else {
  window.spacepeekInitialized = true;
}

// State management
let isActive = false;
let firstElement = null;
let secondElement = null;
let currentMeasurement = null;
let dimensionTooltip = null;
let clearTimer = null;
let cachedImageDimensions = new Map(); // Cache for image dimensions

// Settings management
let settings = {
  units: 'px',
  gridOverlay: false,
  lineColor: '#667eea',
  screenshotFormat: 'png',
  screenshotKey: 'S',
  clearKey: 'Escape'
};

// Event listeners
let clickHandler = null;
let keyDownHandler = null;
let keyUpHandler = null;
let mouseMoveHandler = null;

// Initialize - check state on load and load settings
async function initialize() {
  try {
    // Load settings
    const result = await chrome.storage.local.get('spacepeek_settings');
    if (result.spacepeek_settings) {
      settings = { ...settings, ...result.spacepeek_settings };
    }
    
    // Check if active
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
      if (response && response.isActive) {
        enableMeasurement();
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize SpacePeek:', error);
  }
}

// Initialize on load
initialize();

// Listen for messages from background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enable') {
    enableMeasurement();
    showToast('SpacePeek ON', 'on');
  } else if (request.action === 'disable') {
    disableMeasurement();
    showToast('SpacePeek OFF', 'off');
  } else if (request.action === 'updateSettings') {
    updateSettings(request.settings);
  } else if (request.action === 'ping') {
    // Respond to ping to confirm content script is available
    sendResponse({ available: true });
  }
});

// Enable measurement mode
function enableMeasurement() {
  if (isActive) return;
  
  isActive = true;
  document.body.classList.add('peekspace-active');
  
  // Add event listeners
  clickHandler = handleClick.bind(this);
  keyDownHandler = handleKeyDown.bind(this);
  keyUpHandler = handleKeyUp.bind(this);
  mouseMoveHandler = handleMouseMove.bind(this);
  
  document.addEventListener('click', clickHandler, true);
  document.addEventListener('keydown', keyDownHandler, true);
  document.addEventListener('keyup', keyUpHandler, true);
  document.addEventListener('mousemove', mouseMoveHandler, true);
  
  // Create grid overlay if enabled
  if (settings.gridOverlay) {
    createGridOverlay();
  }
  
  // Show a brief message
  showToast('SpacePeek ON', 'on');
}

// Disable measurement mode
function disableMeasurement() {
  if (!isActive) return;
  
  isActive = false;
  document.body.classList.remove('peekspace-active');
  
  // Remove event listeners
  if (clickHandler) document.removeEventListener('click', clickHandler, true);
  if (keyDownHandler) document.removeEventListener('keydown', keyDownHandler, true);
  if (keyUpHandler) document.removeEventListener('keyup', keyUpHandler, true);
  if (mouseMoveHandler) document.removeEventListener('mousemove', mouseMoveHandler, true);
  
  // Clear all measurements and highlights
  clearMeasurements();
  clearHighlights();
  hideDimensionTooltip();
  
  // Remove grid overlay
  const grid = document.getElementById('peekspace-grid');
  if (grid) {
    grid.remove();
  }
  
  // Reset state
  firstElement = null;
  secondElement = null;
}

// Handle clicks for distance measurement
function handleClick(event) {
  if (!isActive) return;
  
  // Ignore clicks on measurement overlays
  if (event.target.closest('.peekspace-measurement') || 
      event.target.closest('.peekspace-measurement-line') ||
      event.target.closest('.peekspace-measurement-label')) {
    return;
  }
  
  event.preventDefault();
  event.stopPropagation();
  
  const clickedElement = event.target;
  
  // Check if clicking on the same element that's already selected
  if (firstElement === clickedElement) {
    // Unselect first element
    clearMeasurements();
    clearHighlights();
    firstElement = null;
    secondElement = null;
    return;
  }
  
  if (secondElement === clickedElement) {
    // Unselect second element
    clearMeasurements();
    // Remove highlight from second element
    secondElement.classList.remove('peekspace-highlight');
    secondElement.style.removeProperty('outline-color');
    secondElement.style.removeProperty('background-color');
    secondElement.style.removeProperty('--highlight-color');
    secondElement = null;
    return;
  }
  
  if (!firstElement) {
    // First click - select first element
    firstElement = clickedElement;
    highlightElement(firstElement);
  } else if (!secondElement) {
    // Second click - select second element and measure
    secondElement = clickedElement;
    highlightElement(secondElement);
    
    const distance = calculateDistance(firstElement, secondElement);
    drawMeasurement(firstElement, secondElement, distance);
    
  } else {
    // Third click - start new measurement
    clearMeasurements();
    clearHighlights();
    firstElement = clickedElement;
    secondElement = null;
    highlightElement(firstElement);
  }
}

// Handle key events
function handleKeyDown(event) {
  if (!isActive) {
    return;
  }
  
  // Get the pressed key (handle special cases)
  const pressedKey = event.key;
  
  // Detailed key comparison
  const screenshotMatch = pressedKey === settings.screenshotKey;
  const clearMatch = pressedKey === settings.clearKey;
  
  // Clear key - clear measurements
  if (clearMatch) {
    clearMeasurements();
    clearHighlights();
    firstElement = null;
    secondElement = null;
    return;
  }
  
  // Screenshot key - take screenshot
  if (screenshotMatch) {
    event.preventDefault();
    event.stopPropagation();
    takeScreenshot();
    return;
  }
  
  // Debug key - show settings (Ctrl+Shift+D)
  if (event.ctrlKey && event.shiftKey && event.key === 'D') {
    event.preventDefault();
    debugScreenshotSettings();
    return;
  }
}

function handleKeyUp(event) {
  if (!isActive) return;
  
  // No need to handle Alt key anymore
}

// Handle mouse movement for dimension display
function handleMouseMove(event) {
  if (!isActive) {
    hideDimensionTooltip();
    return;
  }
  
  const element = event.target;
  
  // Don't show tooltip for measurement overlays
  if (element.closest('.peekspace-measurement') || 
      element.classList.contains('peekspace-measurement-line') ||
      element.classList.contains('peekspace-measurement-label')) {
    hideDimensionTooltip();
    return;
  }

  // For images, always find the actual image element
  let targetElement = null;
  const imgElement = element.closest('img');
  
  if (imgElement) {
    targetElement = imgElement;
  } else if (element.tagName === 'IMG') {
    targetElement = element;
  }

  // Only show dimensions for images and buttons
  const isImage = targetElement && targetElement.tagName === 'IMG';
  const isButton = element.tagName === 'BUTTON' || 
                  (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit'));

  if (isImage || isButton) {
    // For images, show both rendered and intrinsic sizes
    if (isImage) {
      // Create a unique key for this image
      const imageKey = targetElement.src + '_' + targetElement.className;
      
      // Check if we have cached dimensions for this image
      let cachedDimensions = cachedImageDimensions.get(imageKey);
      
      if (!cachedDimensions) {
        // Calculate and cache dimensions
        const rect = targetElement.getBoundingClientRect();
        const intrinsicWidth = targetElement.naturalWidth || 0;
        const intrinsicHeight = targetElement.naturalHeight || 0;
        
        cachedDimensions = {
          renderedWidth: Math.round(rect.width),
          renderedHeight: Math.round(rect.height),
          intrinsicWidth: intrinsicWidth,
          intrinsicHeight: intrinsicHeight,
          timestamp: Date.now()
        };
        
        cachedImageDimensions.set(imageKey, cachedDimensions);
        
        console.log('Cached new image dimensions:', {
          imageKey: imageKey,
          dimensions: cachedDimensions
        });
      }
      
      if (!dimensionTooltip) {
        dimensionTooltip = document.createElement('div');
        dimensionTooltip.className = 'peekspace-dimension-tooltip';
        document.body.appendChild(dimensionTooltip);
      }
      
      dimensionTooltip.innerHTML = `Rendered size: ${cachedDimensions.renderedWidth} × ${cachedDimensions.renderedHeight} px<br>Intrinsic size: ${cachedDimensions.intrinsicWidth} × ${cachedDimensions.intrinsicHeight} px`;
      dimensionTooltip.style.left = `${event.clientX + 10}px`;
      dimensionTooltip.style.top = `${event.clientY - 30}px`;
      dimensionTooltip.style.display = 'block';
    } else {
      createDimensionTooltip(element, event);
    }
  } else {
    hideDimensionTooltip();
  }
}

// Calculate distance between two elements
function calculateDistance(elem1, elem2) {
  const rect1 = elem1.getBoundingClientRect();
  const rect2 = elem2.getBoundingClientRect();
  
  // Add scroll offset
  const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;
  
  const adjustedRect1 = {
    left: rect1.left + scrollX,
    top: rect1.top + scrollY,
    right: rect1.right + scrollX,
    bottom: rect1.bottom + scrollY
  };
  
  const adjustedRect2 = {
    left: rect2.left + scrollX,
    top: rect2.top + scrollY,
    right: rect2.right + scrollX,
    bottom: rect2.bottom + scrollY
  };
  
  // Check if elements overlap
  const overlapX = adjustedRect1.right >= adjustedRect2.left && adjustedRect2.right >= adjustedRect1.left;
  const overlapY = adjustedRect1.bottom >= adjustedRect2.top && adjustedRect2.bottom >= adjustedRect1.top;
  
  let distance;
  
  if (overlapX && overlapY) {
    distance = 0; // Elements overlap
  } else if (overlapX) {
    // Vertically aligned, measure vertical distance
    distance = Math.min(
      Math.abs(adjustedRect1.top - adjustedRect2.bottom),
      Math.abs(adjustedRect2.top - adjustedRect1.bottom)
    );
  } else if (overlapY) {
    // Horizontally aligned, measure horizontal distance
    distance = Math.min(
      Math.abs(adjustedRect1.left - adjustedRect2.right),
      Math.abs(adjustedRect2.left - adjustedRect1.right)
    );
  } else {
    // Diagonal - calculate shortest distance between closest edges
    const distances = [
      Math.hypot(adjustedRect1.right - adjustedRect2.left, adjustedRect1.bottom - adjustedRect2.top),
      Math.hypot(adjustedRect1.right - adjustedRect2.left, adjustedRect1.top - adjustedRect2.bottom),
      Math.hypot(adjustedRect1.left - adjustedRect2.right, adjustedRect1.bottom - adjustedRect2.top),
      Math.hypot(adjustedRect1.left - adjustedRect2.right, adjustedRect1.top - adjustedRect2.bottom)
    ];
    distance = Math.min(...distances);
  }
  
  return Math.round(distance);
}

// Get closest point on rectangle edge
function getClosestPoint(rect1, rect2) {
  const center1 = {
    x: (rect1.left + rect1.right) / 2,
    y: (rect1.top + rect1.bottom) / 2
  };
  
  const center2 = {
    x: (rect2.left + rect2.right) / 2,
    y: (rect2.top + rect2.bottom) / 2
  };
  
  // Find which edge of rect1 is closest to center of rect2
  let closestPoint = { x: center1.x, y: center1.y };
  
  if (center2.x < rect1.left) {
    closestPoint.x = rect1.left;
  } else if (center2.x > rect1.right) {
    closestPoint.x = rect1.right;
  }
  
  if (center2.y < rect1.top) {
    closestPoint.y = rect1.top;
  } else if (center2.y > rect1.bottom) {
    closestPoint.y = rect1.bottom;
  }
  
  return closestPoint;
}

// Draw measurement line and label
function drawMeasurement(elem1, elem2, distance) {
  // Clear existing measurement
  clearMeasurements();
  
  // Create container
  const container = document.createElement('div');
  container.className = 'peekspace-measurement';
  
  // Get positions
  const rect1 = elem1.getBoundingClientRect();
  const rect2 = elem2.getBoundingClientRect();
  
  // Find closest points between elements
  const point1 = getClosestPoint(rect1, rect2);
  const point2 = getClosestPoint(rect2, rect1);
  
  // Create line
  const line = document.createElement('div');
  line.className = 'peekspace-measurement-line';
  
  // Calculate line position and angle
  const length = Math.hypot(point2.x - point1.x, point2.y - point1.y);
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x);
  
  line.style.width = `${length}px`;
  line.style.left = `${point1.x}px`;
  line.style.top = `${point1.y}px`;
  line.style.transform = `rotate(${angle}rad)`;
  line.style.backgroundColor = settings.lineColor || '#667eea';
  
  // Create label
  const label = document.createElement('div');
  label.className = 'peekspace-measurement-label';
  label.textContent = formatDistance(distance);
  label.dataset.distance = distance; // Store original distance for unit conversion
  label.style.left = `${(point1.x + point2.x) / 2}px`;
  label.style.top = `${(point1.y + point2.y) / 2}px`;
  
  container.appendChild(line);
  container.appendChild(label);
  document.body.appendChild(container);
  
  currentMeasurement = container;
  
  // Auto-clear after 5 seconds
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    clearMeasurements();
    clearHighlights();
    firstElement = null;
    secondElement = null;
  }, 5000);
}

// Highlight element
function highlightElement(element) {
  element.classList.add('peekspace-highlight');
  
  // Apply custom highlight color to match line color
  const lineColor = settings.lineColor || '#667eea';
  element.style.outlineColor = lineColor;
  element.style.backgroundColor = `${lineColor}15`; // 15% opacity
  
  // Update the ::after pseudo-element color using CSS custom property
  element.style.setProperty('--highlight-color', lineColor);
}

// Clear all highlights
function clearHighlights() {
  const highlighted = document.querySelectorAll('.peekspace-highlight');
  highlighted.forEach(el => {
    el.classList.remove('peekspace-highlight');
    // Remove inline styles that were added
    el.style.removeProperty('outline-color');
    el.style.removeProperty('background-color');
    el.style.removeProperty('--highlight-color');
  });
}

// Clear all measurements
function clearMeasurements() {
  if (currentMeasurement) {
    currentMeasurement.remove();
    currentMeasurement = null;
  }
  
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
}

// Create dimension tooltip
function createDimensionTooltip(element, event) {
  const rect = element.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  
  if (!dimensionTooltip) {
    dimensionTooltip = document.createElement('div');
    dimensionTooltip.className = 'peekspace-dimension-tooltip';
    document.body.appendChild(dimensionTooltip);
  }
  
  const widthFormatted = formatDistance(width);
  const heightFormatted = formatDistance(height);
  dimensionTooltip.textContent = `${widthFormatted} × ${heightFormatted}`;
  dimensionTooltip.style.left = `${event.clientX + 10}px`;
  dimensionTooltip.style.top = `${event.clientY - 30}px`;
  dimensionTooltip.style.display = 'block';
}

// Hide dimension tooltip
function hideDimensionTooltip() {
  if (dimensionTooltip) {
    dimensionTooltip.style.display = 'none';
  }
}

// Show toast notification
function showToast(message, type) {
  // Remove existing toast
  const existingToast = document.querySelector('.peekspace-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `peekspace-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }, 2000);
}

// Add this new simplified screenshot function
function takeScreenshot() {
  // Show feedback
  showToast('Taking screenshot...', 'success');
  
  // Check if chrome.runtime is available
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('Chrome runtime not available');
    showToast('Screenshot failed - extension not available', 'error');
    return;
  }
  
  // Request screenshot from background script
  chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Runtime error:', chrome.runtime.lastError);
      showToast('Screenshot failed - ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    
    if (response && response.error) {
      console.error('Screenshot error:', response.error);
      showToast('Screenshot failed - ' + response.error, 'error');
      return;
    }
    
    if (response && response.dataUrl) {
      try {
        // Create download link
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const format = settings.screenshotFormat || 'png';
        link.download = `spacepeek-screenshot-${timestamp}.${format}`;
        link.href = response.dataUrl;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Screenshot saved!', 'success');
      } catch (error) {
        console.error('Download error:', error);
        showToast('Screenshot failed - download error', 'error');
      }
    } else {
      console.error('Screenshot failed - no data received');
      showToast('Screenshot failed - no data received', 'error');
    }
  });
}

// Toggle settings panel
function toggleSettingsPanel() {
  showToast('Settings panel coming soon!', 'info');
  // TODO: Implement settings panel functionality
} 

// Update settings
function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  
  // Update existing measurements with new settings
  if (isActive) {
    updateMeasurementDisplay();
  }
  
  // Update grid overlay
  updateGridOverlay();
}

// Update measurement display with current settings
function updateMeasurementDisplay() {
  const measurements = document.querySelectorAll('.peekspace-measurement');
  
  measurements.forEach(measurement => {
    const label = measurement.querySelector('.peekspace-measurement-label');
    if (label) {
      // Get the original distance in pixels
      let distance = parseFloat(label.dataset.distance);
      
      // If no dataset distance, try to parse from current text
      if (isNaN(distance)) {
        const currentText = label.textContent;
        const pxMatch = currentText.match(/(\d+(?:\.\d+)?)px/);
        if (pxMatch) {
          distance = parseFloat(pxMatch[1]);
          // Store it for future use
          label.dataset.distance = distance;
        }
      }
      
      if (!isNaN(distance)) {
        const formatted = formatDistance(distance);
        label.textContent = formatted;
      }
    }
    
    // Update line color
    const line = measurement.querySelector('.peekspace-measurement-line');
    if (line) {
      line.style.backgroundColor = settings.lineColor || '#667eea';
    }
  });
  
  // Update existing highlights
  const highlights = document.querySelectorAll('.peekspace-highlight');
  const lineColor = settings.lineColor || '#667eea';
  highlights.forEach(highlight => {
    highlight.style.outlineColor = lineColor;
    highlight.style.backgroundColor = `${lineColor}15`;
    highlight.style.setProperty('--highlight-color', lineColor);
  });
}

// Update grid overlay
function updateGridOverlay() {
  const existingGrid = document.getElementById('peekspace-grid');
  if (existingGrid) {
    existingGrid.remove();
  }
  
  if (settings.gridOverlay && isActive) {
    createGridOverlay();
  }
}

// Create grid overlay
function createGridOverlay() {
  const grid = document.createElement('div');
  grid.id = 'peekspace-grid';
  grid.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9998;
    background-image: 
      linear-gradient(rgba(102, 126, 234, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  `;
  document.body.appendChild(grid);
}

// Format distance based on units
function formatDistance(distance) {
  switch (settings.units) {
    case 'rem':
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return `${(distance / rootFontSize).toFixed(2)}rem`;
    case 'em':
      const parentFontSize = parseFloat(getComputedStyle(document.body).fontSize);
      return `${(distance / parentFontSize).toFixed(2)}em`;
    default:
      return `${Math.round(distance)}px`;
  }
}

// Debug function to test screenshot settings
function debugScreenshotSettings() {
  console.log('=== Screenshot Settings Debug ===');
  console.log('Current settings:', settings);
  console.log('Screenshot key:', settings.screenshotKey);
  console.log('Is active:', isActive);
  
  // Test if we can access chrome.runtime
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    console.log('Chrome runtime available');
  } else {
    console.log('Chrome runtime not available');
  }
  
  // Test if we can send messages
  try {
    chrome.runtime.sendMessage({ action: 'test' }, (response) => {
      console.log('Message test response:', response);
    });
  } catch (error) {
    console.error('Message test failed:', error);
  }
  
  // Show a test message
  showToast('Debug mode activated', 'info');
}

// Manual test function - call this from console to test screenshot
window.testSpacePeekScreenshot = function() {
  console.log('=== Manual Screenshot Test ===');
  console.log('Current settings:', settings);
  console.log('Is active:', isActive);
  console.log('Screenshot key:', settings.screenshotKey);
  
  if (!isActive) {
    console.log('SpacePeek is not active - enabling it first');
    enableMeasurement();
  }
  
  takeScreenshot();
};

// Function to show current keyboard settings
window.showSpacePeekSettings = function() {
  console.log('=== SpacePeek Current Settings ===');
  console.log('Screenshot Key:', settings.screenshotKey);
  console.log('Clear Key:', settings.clearKey);
  console.log('Is Active:', isActive);
  console.log('All Settings:', settings);
  
  // Show a toast with current settings
  showToast('Settings displayed in console', 'info');
};

// Function to test a specific key
window.testKey = function(key) {
  console.log(`=== Testing Key: ${key} ===`);
  console.log('Current screenshot key:', settings.screenshotKey);
  console.log('Key match:', key === settings.screenshotKey);
  
  // Create a test event
  const event = new KeyboardEvent('keydown', {
    key: key,
    code: `Key${key.toUpperCase()}`,
    keyCode: key.charCodeAt(0),
    which: key.charCodeAt(0),
    bubbles: true,
    cancelable: true
  });
  
  document.dispatchEvent(event);
}; 