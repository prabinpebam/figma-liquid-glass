// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 400 });

// Listen for messages from the UI.
figma.ui.onmessage = (msg) => {
  // A common message is to close the plugin.
  if (msg.type === 'close') {
    figma.closePlugin();
  }

  // You can handle other messages from the UI here.
};