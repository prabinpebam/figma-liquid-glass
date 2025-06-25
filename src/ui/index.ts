// This file contains the TypeScript code that handles the UI logic and interactions. It communicates with the main plugin code in code.ts.

// helper to echo logs into plugin console as well
function sendLog(message: string) {
  console.log(message);
  parent.postMessage({ pluginMessage: { type: 'ui-log', payload: message } }, '*');
}

// -- init ----------------------------------------------------
function init() {
  sendLog('[UI] init');

  const captureBtn = document.getElementById('capture-btn');
  const outputImg  = document.getElementById('output-img') as HTMLImageElement | null;

  captureBtn?.addEventListener('click', () => {
    sendLog('[UI] Capture button clicked');
    parent.postMessage({ pluginMessage: { type: 'capture-image' } }, '*');
  });

  // Receive messages from plugin
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;

    sendLog(`[UI] Received message: ${JSON.stringify(msg)}`);

    if (msg.type === 'image-captured') {
      if (msg.error) {
        alert(msg.error);
      } else if (outputImg) {
        outputImg.src = msg.data;
      }
    }
  };
}

// run init right away or after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}