# <img src="assets/liquid-glass-logo.png" width="48" align="center"> Liquid Glass Figma Plugin

![Liquid Glass Plugin Banner](assets/liquid-glass-banner.png)

## Overview
"Liquid Glass" is a Figma plugin that creates and manages realistic liquid glass components using WebGL shaders. The plugin generates a pre-structured, multi-layer frame that captures the background beneath it and applies advanced visual effects like refraction, chromatic aberration, and blur to simulate a liquid glass appearance.

## UI
![Liquid Glass Plugin Banner](assets/liquid-glass-ui-panel.png)

## Getting Started

### Prerequisites
- Node.js (version 12 or later)
- npm (Node package manager)
- Figma (desktop or web version)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd liquid-glass
   ```

2. Install the dependencies:
   ```
   npm install
   ```

### Running the Plugin
1. Build the plugin:
   ```
   npm run build
   ```
2. Open Figma and navigate to the Plugins menu.
3. Select "Development" and then "Import plugin from manifest...".
4. Select the `manifest.json` file from the `dist/` directory.
5. You can now run the plugin from the Plugins menu in Figma.

## Features

### Liquid Glass Effect
- **Real-time background capture** of content beneath the element.
- **WebGL-powered rendering** with advanced shader effects:
  - Edge distortion with customizable thickness (1-50px)
  - Refraction strength control (1-100)
  - Chromatic aberration (0-30)
  - Background blur/frostiness (0-20)
- **Batch Update**: Refresh all Liquid Glass elements on the current page with a single click.

### Workflow
The plugin operates in three main modes: creating, editing, and batch updating.

1. **Create Mode**
   - With no Liquid Glass element selected, adjust the parameters in the plugin UI.
   - Click "Create" to generate a new, fully-styled component in the center of your viewport.
   - The new element is automatically selected, switching the plugin to Edit Mode.

2. **Edit Mode (Live Updates)**
   - When a Liquid Glass element is selected, the plugin UI automatically loads its parameters into the sliders.
   - Any change to the sliders will update the selected element's appearance in real-time.
   - Moving, resizing, or changing the corner radius of the element on the Figma canvas will also trigger an automatic refresh of the background effect.

3. **Batch Update Mode**
   - Click the "Update all" button to refresh every Liquid Glass element on the current page.
   - When any elements are selected (single or multiple), the button changes to "Update selection" and will update all Liquid Glass elements found within the selection (including nested ones).
   - The plugin will cycle through each element, bring it into view to capture the background, and apply the updated effect.
   - The process can be interrupted by interacting with the Figma canvas.

### Applied Figma Styling
When creating a Liquid Glass element, the plugin applies a specific style structure:
- **Main Frame**: 
  - `cornerRadius` can be adjusted (defaults to 50px).
  - **Drop shadow**: offset (3, 6), blur 10, opacity 25%.
- **Refraction Layer**:
  - **Angular gradient border**: 1px thickness with white highlights.
  - **Inner shadow**: offset (10, 10), blur 10, opacity 40%.
- **Highlight Layer**:
  - A blurred reflection effect using a thick (8px), centered angular gradient stroke and a layer blur of 24px.

## Development

### Building the Plugin
```bash
# One-time build
npm run build

# Watch mode for development
npm run watch

# Type checking only
npm run type-check
```

### Project Structure
```
liquid-glass/
├── src/
│   ├── code.ts           # Main plugin logic (TypeScript)
│   └── ui/
│       └── index.html    # Self-contained UI (HTML, CSS, JS, WebGL Shaders)
├── dist/                 # Compiled output
├── assets/               # Image assets for README
│   ├── promo-banner.png
│   ├── plugin-ui.png
│   └── icon.png
├── manifest.json         # Figma plugin manifest
└── package.json
```

## Usage

This is the plugin UI you will be working with:

![Plugin UI](./assets/plugin-ui.png)

### Creating an Element
1. **Open the Liquid Glass plugin**.
2. **Adjust parameters** using the sliders to your preference.
3. **Click "Create"**. A new element will appear on your canvas.

### Editing an Element
1. **Select a Liquid Glass element** on the Figma canvas.
2. The plugin UI will automatically update to show its current settings.
3. **Adjust sliders** in the plugin to see the effect change in real-time.
4. **Move, resize, or change the corner radius** of the main frame directly on the canvas. The effect will automatically update.

### Batch Updating
- **Click "Update all"** in the plugin panel to refresh every Liquid Glass element on the page.
- **Click "Update selection"** (when elements are selected) to refresh only the Liquid Glass elements within your selection. This is useful for updating specific groups or frames containing multiple LG elements.

### Layer Naming Convention
Applied effects use this naming format:
- `[LG - ET20 RS25 CA5 BB0]`
  - `LG` = Liquid Glass
  - `ET20` = Edge Thickness: 20
  - `RS25` = Refraction Strength: 25
  - `CA5` = Chromatic Aberration: 5
  - `BB0` = Background Blur: 0

## Technical Details

### WebGL Shaders
The plugin uses custom WebGL fragment shaders to achieve:
- **Signed Distance Functions (SDF)** for precise shape calculations.
- **Multi-sample blur** for frosting effects.
- **Chromatic aberration** with separate RGB channel distortion.
- **Real-time refraction** based on distance from shape edges.

### Performance
- **Live editing mode** provides real-time updates as you move, resize, or adjust sliders.
- **Optimized rendering** with efficient WebGL texture handling.
- **Smart caching** of element bounds to avoid unnecessary recalculations.

## Browser Compatibility
- Requires WebGL support (available in all modern browsers)
- Tested on Chrome, Firefox, Safari, and Figma desktop app.

## Contributing
If you would like to contribute to the project, please fork the repository and submit a pull request with your changes.

## License
This project is licensed under the MIT License. Authored by Prabin Pebam.