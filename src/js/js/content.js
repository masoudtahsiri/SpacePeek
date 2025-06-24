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

  // Only show dimensions for images and buttons
  if (element.tagName === 'IMG' || element.tagName === 'BUTTON' || 
      element.tagName === 'INPUT' && element.type === 'button' ||
      element.tagName === 'INPUT' && element.type === 'submit') {
    createDimensionTooltip(element, event);
  } else {
    hideDimensionTooltip();
  }
} 