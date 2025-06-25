// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 400 });

const OFFSET = 20; // px extra margin around the selection

// util ──────────────────────────────────────────────────────
function rectsIntersect(a:{x:number;y:number;width:number;height:number},
                        b:{x:number;y:number;width:number;height:number}) {
  return !(a.x + a.width  <= b.x ||
           b.x + b.width  <= a.x ||
           a.y + a.height <= b.y ||
           b.y + b.height <= a.y);
}

function nodeBounds(node: SceneNode) {
  const t = node.absoluteTransform;
  return { x: t[0][2], y: t[1][2], width: (node as any).width, height: (node as any).height };
}

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

    const target = selection[0];

    /* 1 — capture rectangle around the target with padding */
    const { width, height } = target as any;
    const absX = target.absoluteTransform[0][2];
    const absY = target.absoluteTransform[1][2];
    const captureRect = {
      x: absX - OFFSET,
      y: absY - OFFSET,
      width:  width + OFFSET * 2,
      height: height + OFFSET * 2
    };

    /* 2 — collect nodes to hide: the target itself and every
           other visible node overlapping the rect that is ABOVE
           the target in layer order.                                       */
    const nodesToRestore: { node: SceneNode; opacity: number }[] = [];

    function hide(node: SceneNode) {
      nodesToRestore.push({ node, opacity: (node as any).opacity ?? 1 });
      (node as any).opacity = 0;
    }

    const parent = target.parent;
    const siblings = parent ? parent.children : [];

    let foundTarget = false;
    for (const n of siblings) {
      if (n === target) {
        foundTarget = true;
        hide(n);            // hide target
        continue;
      }
      if (!foundTarget) continue; // below the target → keep
      if ((n as any).visible === false) continue;

      const b = nodeBounds(n);
      if (rectsIntersect(b, captureRect)) hide(n);
    }

    /* 3 — create slice, export */
    const slice = figma.createSlice();
    slice.x = captureRect.x;
    slice.y = captureRect.y;
    slice.resizeWithoutConstraints(captureRect.width, captureRect.height);

    const bytes  = await slice.exportAsync({ format: 'PNG' });
    const base64 = figma.base64Encode(bytes);

    /* 4 — restore everything */
    slice.remove();
    for (const { node, opacity } of nodesToRestore) (node as any).opacity = opacity;

    /* 5 — send to UI */
    figma.ui.postMessage({ type: 'image-captured', data: `data:image/png;base64,${base64}` });
  }

  // You can handle other messages from the UI here.
};