// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 400 });

const OFFSET = 20; // px extra margin around the selection

// Listen for messages from the UI.
figma.ui.onmessage = async (msg) => {
  // forward logs coming from the UI --------------------------
  if (msg.type === 'ui-log') {
    console.log('[UI]', msg.payload);
    return;
  }
  // ----------------------------------------------------------

  console.log('[Plugin] Received message:', msg);           // <-- added

  // A common message is to close the plugin.
  if (msg.type === 'close') {
    figma.closePlugin();
  }

  if (msg.type === 'capture-image') {
    console.log('[Plugin] capture-image requested');        // <-- added

    const selection = figma.currentPage.selection;
    console.log('[Plugin] Current selection length:', selection.length); // <-- added
    if (selection.length !== 1) {
      figma.ui.postMessage({
        type: 'image-captured',
        error: 'Please select a single node.'
      });
      console.log('[Plugin] Error – wrong selection count');            // <-- added
      figma.notify('Select exactly one node');
      return;
    }

    const node = selection[0];

    // 1. store & hide selected node so it doesn’t appear in the capture
    const wasVisible = (node as any).visible ?? true;
    (node as any).visible = false;

    // 2. compute slice bounds
    const { width, height } = node as any;
    const absX = node.absoluteTransform[0][2];
    const absY = node.absoluteTransform[1][2];

    const slice = figma.createSlice();
    slice.x = absX - OFFSET;
    slice.y = absY - OFFSET;
    slice.resizeWithoutConstraints(width + OFFSET * 2, height + OFFSET * 2);

    // 3. export region
    const bytes  = await slice.exportAsync({ format: 'PNG' });
    const base64 = figma.base64Encode(bytes);
    console.log('[Plugin] Slice exported, byte length:', bytes.length);

    // 4. clean-up & restore
    slice.remove();
    (node as any).visible = wasVisible;

    // 5. send to UI
    figma.ui.postMessage({
      type: 'image-captured',
      data: `data:image/png;base64,${base64}`
    });
  }

  // You can handle other messages from the UI here.
};