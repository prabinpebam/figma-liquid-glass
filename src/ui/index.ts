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
  const closeBtn   = document.getElementById('close-btn');
  const outputImg  = document.getElementById('output-img') as HTMLImageElement | null;

  captureBtn?.addEventListener('click', () => {
    sendLog('[UI] Capture button clicked');
    parent.postMessage({ pluginMessage: { type: 'capture-image' } }, '*');
  });

  closeBtn?.addEventListener('click', () => {
    sendLog('[UI] Close button clicked');
    parent.postMessage({ pluginMessage: { type: 'close' } }, '*');
  });

  // Receive messages from plugin
  window.onmessage = async (event) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;

    sendLog(`[UI] Received message: ${JSON.stringify(msg)}`);

    if (msg.type === 'image-captured') {
      if (msg.error) {
        alert(msg.error);
      } else {
        const inverted = await cropAndInvert(msg.data);
        if (outputImg) {
          outputImg.src = inverted;
          outputImg.style.display = 'block';
          // remove placeholder text once we have the image
          document.getElementById('placeholder')?.remove();
        }
        parent.postMessage({ pluginMessage: { type: 'apply-image-fill', data: inverted } }, '*');
      }
    }
  };
}

const OFFSET = 20; // must match code.ts

// Replace invertImage with a combined crop-and-invert
async function cropAndInvert(dataURL: string): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width  - OFFSET * 2;
      const h = img.height - OFFSET * 2;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;

      // draw the inner region (crop)
      ctx.drawImage(img, OFFSET, OFFSET, w, h, 0, 0, w, h);

      // invert
      const id = ctx.getImageData(0, 0, w, h);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i]     = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(id, 0, 0);

      res(c.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}

// run init right away or after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}