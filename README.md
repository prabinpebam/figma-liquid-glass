# Liquid Glass Figma Plugin

## Overview
"Liquid Glass" is a Figma plugin designed to enhance your design workflow by providing unique features and functionalities. This README provides instructions on how to set up and run the plugin.

## Getting Started

### Prerequisites
- Node.js (version 12 or later)
- npm (Node package manager)

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
1. Open Figma and navigate to the Plugins menu.
2. Select "Development" and then "New Plugin...".
3. Choose "Link existing plugin" and select the `manifest.json` file from the `liquid-glass` directory.
4. You can now run the plugin from the Plugins menu in Figma.

### Building the Plugin
To build the TypeScript files, run:
```
npm run build
```

## Features (current WIP)
- Live background capture of anything beneath the selected layer.
- Effect selector  
  - **None** – disable all processing.  
  - **Liquid glass** – placeholder for upcoming frosted-glass effect.  
  - **Invert** – captures, crops and colour-inverts the background, then sets it as an image fill.
- Automatic refresh after move / resize (throttled for performance).
- Temporary white overlay while editing to indicate that the final effect will be applied.

## Development scripts
```bash
# one-off compile
npm run build

# watch TypeScript & HTML, rebuild automatically
npm run watch
```

The compiled files land in the `dist` folder; `manifest.json` already points to them.

## Using the plugin inside Figma
1. Select a single frame/shape.  
2. Open the plugin → choose an effect with the radio buttons.  
3. Move or resize the layer – the chosen effect updates automatically on release.

## Roadmap
- Implement “Liquid glass” effect (blur + transparency).
- Add settings for offset, blur radius, and inversion strength.
- Performance tuning for large canvases.

## Contributing
If you would like to contribute to the project, please fork the repository and submit a pull request with your changes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.