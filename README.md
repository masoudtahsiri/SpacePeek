# SpacePeek - Web Measurement Tool

A Chrome Extension that measures distances between elements and shows element dimensions on web pages. Perfect for developers, designers, and anyone who needs precise measurements on websites.

![SpacePeek Demo](https://img.shields.io/badge/Version-1.0.0-blue) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)

## 🚀 Features

### Distance Measurement
- **Click two elements** to measure the distance between them
- Shows **visual line** connecting the elements with pixel-perfect measurements
- Displays **edge-to-edge distance** (closest edges between elements)
- **Auto-clear** measurements after 5 seconds or press ESC to clear manually
- Handles **overlapping elements** correctly (shows 0px distance)

### Dimension Display
- **Hold Alt/Option + hover** over any element to see its dimensions
- Shows **width × height** in pixels in a dark tooltip
- Works with all HTML elements including fixed/absolute positioned ones

### Smart Toggle
- **Click extension icon** to toggle measurement mode on/off
- **Visual feedback**: Crosshair cursor when active
- **Toast notifications**: "SpacePeek ON" / "SpacePeek OFF"
- **Per-tab state management**: Each tab remembers its own state
- **Auto-cleanup**: State cleared when tabs are closed

## 📦 Installation

### Option 1: Load as Unpacked Extension (Development)

1. **Download or clone this repository**
   ```bash
   git clone https://github.com/yourusername/spacepeek.git
   cd spacepeek
   ```

2. **Open Chrome Extensions page**
   - Go to `chrome://extensions/` in your browser
   - Or click Menu → More Tools → Extensions

3. **Enable Developer mode**
   - Toggle the "Developer mode" switch in the top right

4. **Load the extension**
   - Click "Load unpacked"
   - Select the `src` folder from this project
   - The extension should now appear in your extensions list

5. **Pin the extension** (recommended)
   - Click the puzzle piece icon in Chrome toolbar
   - Click the pin icon next to SpacePeek to keep it visible

### Option 2: Chrome Web Store (Coming Soon)
*This extension will be available on the Chrome Web Store soon.*

## 🎯 How to Use

### Basic Distance Measurement

1. **Activate SpacePeek**
   - Click the SpacePeek icon in your Chrome toolbar
   - You'll see "SpacePeek ON" notification
   - Cursor changes to crosshair

2. **Measure Distance**
   - Click on first element (it will be highlighted in blue)
   - Click on second element (also highlighted)
   - A blue line appears showing the distance in pixels

3. **Clear Measurements**
   - Wait 5 seconds for auto-clear, OR
   - Press the `ESC` key, OR
   - Click a third element to start a new measurement

4. **Deactivate**
   - Click the SpacePeek icon again
   - You'll see "SpacePeek OFF" notification

### Element Dimensions

1. **While SpacePeek is ON**
   - Hold `Alt` key (Windows/Linux) or `Option` key (Mac)
   - Hover over any element
   - See width × height tooltip appear

2. **Release Alt/Option** to hide the tooltip

### Keyboard Shortcuts

- **S** - Take a screenshot of the current view
- **ESC** - Clear current measurements
- **Alt/Option + Hover** - Show element dimensions

## 🛠️ Technical Details

### File Structure
```
src/
├── manifest.json          # Extension configuration
├── js/
│   ├── background.js      # Service worker for state management
│   └── content.js         # Main measurement logic
├── css/
│   └── content.css        # Styles for measurements and UI
├── icons/
│   ├── icon16.png         # 16×16 toolbar icon
│   ├── icon48.png         # 48×48 extension icon  
│   └── icon128.png        # 128×128 store icon
└── popup.html             # Fallback for restricted sites
```

### Key Technologies
- **Manifest V3** - Latest Chrome extension format
- **Content Scripts** - Injected into web pages for measurements
- **Chrome Storage API** - Per-tab state persistence
- **Service Worker** - Background processing and state management

### Distance Calculation Algorithm
- **Overlapping elements**: Returns 0px
- **Vertically aligned**: Measures vertical gap
- **Horizontally aligned**: Measures horizontal gap  
- **Diagonal**: Calculates shortest distance between closest edges using Pythagorean theorem

### Browser Compatibility
- ✅ **Chrome 88+** (Manifest V3 support required)
- ✅ **Chromium-based browsers** (Edge, Brave, etc.)
- ❌ **Firefox** (uses different extension format)
- ❌ **Safari** (uses different extension format)

## 🔧 Development

### Prerequisites
- Chrome 88+ with Developer mode enabled

### Local Development
1. Clone the repository
2. Make changes to files in `src/` directory
3. Go to `chrome://extensions/`
4. Click "Reload" button on the SpacePeek extension
5. Test your changes on any website

### Building Icons
If you need to recreate the icons:
```bash
# Requires ImageMagick
magick -size 16x16 xc:"#2196F3" -fill white -stroke white -strokewidth 1 \
  -draw "line 2,8 14,8" -draw "line 2,6 2,10" -draw "line 14,6 14,10" \
  src/icons/icon16.png

magick -size 48x48 xc:"#2196F3" -fill white -stroke white -strokewidth 2 \
  -draw "line 6,24 42,24" -draw "line 6,18 6,30" -draw "line 42,18 42,30" \
  -draw "circle 24,24 24,20" src/icons/icon48.png

magick -size 128x128 xc:"#2196F3" -fill white -stroke white -strokewidth 3 \
  -draw "line 16,64 112,64" -draw "line 16,48 16,80" -draw "line 112,48 112,80" \
  -draw "circle 64,64 64,50" -fill none -stroke white -strokewidth 2 \
  -draw "circle 64,64 64,40" src/icons/icon128.png
```

## 🎨 Customization

### Changing Colors
Edit `src/css/content.css` and modify these CSS variables:
```css
/* Main measurement color */
.peekspace-measurement-line {
  background: #2196F3; /* Change this color */
}

/* Highlight color */
.peekspace-highlight {
  outline-color: #2196F3 !important; /* Change this color */
}
```

### Adjusting Timing
Edit `src/js/content.js`:
```javascript
// Auto-clear timeout (currently 5 seconds)
clearTimer = setTimeout(() => {
  clearMeasurements();
  // ...
}, 5000); // Change this value (milliseconds)
```

## 🚫 Limitations

- **Restricted sites**: Cannot run on chrome://, chrome-extension://, or some internal pages
- **Cross-origin iframes**: Limited access to iframe content from different domains  
- **Dynamic content**: Measurements may become inaccurate if page content changes
- **Mobile support**: Limited touch device support (designed for desktop)

## 🐛 Troubleshooting

### Extension Not Working
1. **Check extension is enabled** in `chrome://extensions/`
2. **Reload the extension** if you made changes
3. **Refresh the webpage** you're trying to measure
4. **Check console** (F12) for any error messages

### Measurements Seem Wrong
1. **Try refreshing the page** - dynamic content can affect measurements
2. **Check if elements have transforms** - CSS transforms may affect positioning
3. **Disable other extensions** temporarily to check for conflicts

### Can't See Measurements
1. **Check z-index conflicts** - some websites may override our styles
2. **Look for browser zoom** - measurements work best at 100% zoom
3. **Try different elements** - some elements may be positioned oddly

## 📝 License

MIT License - feel free to use, modify, and distribute.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

### Feature Ideas
- [ ] Ruler overlay for precise positioning
- [ ] Color picker integration
- [ ] Export measurements to CSV
- [ ] Keyboard shortcuts for quick access
- [ ] Multiple measurement sessions
- [ ] Angle measurements
- [ ] Area calculations

## 🔗 Links

- [Chrome Web Store](#) *(Coming Soon)*
- [Report Issues](https://github.com/yourusername/spacepeek/issues)
- [Feature Requests](https://github.com/yourusername/spacepeek/discussions)

---

**Made with ❤️ for developers and designers who need precise web measurements.** 