# Liquid Glass Figma Plugin

## Overview
"Liquid Glass" is a Figma plugin that creates realistic liquid glass effects using WebGL shaders. The plugin captures the background beneath selected shapes and applies advanced visual effects including refraction distortion, chromatic aberration, and background blur to simulate the appearance of liquid glass.

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
4. Select the `manifest.json` file from the `liquid-glass` directory.
5. You can now run the plugin from the Plugins menu in Figma.

## Features

### Liquid Glass Effect
- **Real-time background capture** of content beneath selected shapes
- **WebGL-powered rendering** with advanced shader effects:
  - Edge distortion with customizable thickness (1-50px)
  - Refraction strength control (1-100)
  - Chromatic aberration (0-30)
  - Background blur/frostiness (0-20)

### Dual Trigger System
1. **Manual Application**
   - Select a shape, adjust parameters, and click "Apply"
   - Applies complete Figma styling (borders, shadows, effects)
   - Layer is renamed with effect parameters: `[LG - ET20 RS25 CA5 BB0]`

2. **Automatic Updates**
   - Shapes with active Liquid Glass effect automatically update when moved or resized
   - Effect parameters are parsed from the layer name
   - Only updates the background image, preserves all other Figma properties

### Applied Figma Styling
When manually applying Liquid Glass effect, the plugin adds:
- **Angular gradient border** (2px thickness with white highlights)
- **Inner shadow** (offset: 12,12 | blur: 30 | opacity: 70%)
- **Drop shadow** (offset: 0,6 | blur: 5 | opacity: 25%)

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
│   ├── code.ts           # Main plugin logic
│   └── ui/
│       └── index.html    # Plugin UI with embedded WebGL shaders
├── dist/                 # Compiled output
├── manifest.json         # Figma plugin manifest
└── package.json
```

## Usage

### Basic Workflow
1. **Select a shape** in Figma (rectangle, frame, etc.)
2. **Open the Liquid Glass plugin**
3. **Adjust parameters** using the sliders:
   - Edge thickness: Controls the width of the distortion effect
   - Refraction strength: Intensity of the glass distortion
   - Chromatic aberration: Color fringing effect at edges
   - Background blur: Frosting/blur effect on the background
4. **Click "Apply"** to apply the effect with full Figma styling

### Automatic Updates
- Shapes with applied Liquid Glass effect (identifiable by layer names like `[LG - ET20 RS25 CA5 BB0]`) will automatically update their background when moved or resized
- The effect parameters are preserved from the original application
- No need to manually reapply unless you want to change the effect parameters

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
- **Signed Distance Functions (SDF)** for precise shape calculations
- **Multi-sample blur** for frosting effects
- **Chromatic aberration** with separate RGB channel distortion
- **Real-time refraction** based on distance from shape edges

### Performance
- **Automatic mode** provides real-time updates as you move/resize shapes
- **Optimized rendering** with efficient WebGL texture handling
- **Smart caching** to avoid unnecessary recalculations

## Browser Compatibility
- Requires WebGL support (available in all modern browsers)
- Tested on Chrome, Firefox, Safari, and Figma desktop app

## Contributing
If you would like to contribute to the project, please fork the repository and submit a pull request with your changes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.