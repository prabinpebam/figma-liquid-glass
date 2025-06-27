// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 400 });

const OFFSET = 20; // px extra margin around the selection

/* ────────────── transient state ────────────── */
const editState = {
  node:     null as SceneNode | null,
  lastBounds: null as { x:number; y:number; width:number; height:number } | null
};

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

function boundsEqual(a: typeof editState.lastBounds, b: typeof editState.lastBounds) {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/* helpers */
function parseLayerName(name: string): { [key: string]: number } | null {
  if (!name.startsWith('[LG - ') || !name.endsWith(']')) return null;
  const paramsStr = name.substring(6, name.length - 1);
  const params: { [key: string]: number } = {};
  const parts = paramsStr.split(' ');
  try {
    parts.forEach(part => {
      if (part.startsWith('ET')) params.edge = parseFloat(part.substring(2));
      if (part.startsWith('RS')) params.strength = parseFloat(part.substring(2));
      if (part.startsWith('CA')) params.ca = parseFloat(part.substring(2));
      if (part.startsWith('BB')) params.frost = parseFloat(part.substring(2));
    });
    if (params.edge === undefined || params.strength === undefined || params.ca === undefined || params.frost === undefined) return null;
    return params;
  } catch (e) {
    return null;
  }
}

function formatLayerName(params: { [key: string]: any }): string {
  const et = `ET${params.edge}`;
  const rs = `RS${params.strength}`;
  const ca = `CA${params.ca}`;
  const bb = `BB${params.frost}`;
  return `[LG - ${et} ${rs} ${ca} ${bb}]`;
}

async function captureAndSend(target: SceneNode, params: any, context: 'apply' | 'update') {
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

    // Get shape properties for the liquid glass effect
    let shapeProps = null;
    if ('cornerRadius' in target) {
        let radius = 0;
        const cr = (target as any).cornerRadius;
        if (typeof cr === 'number') {
            radius = cr;
        } else if (Array.isArray(cr)) {
            radius = cr[0] || 0;
        }
        // If cr is undefined or figma.mixed (symbol), radius stays 0.
        shapeProps = {
            width: (target as any).width,
            height: (target as any).height,
            cornerRadius: radius
        };
    }
    /* 5 — send to UI */
    figma.ui.postMessage({ type: 'image-captured', data: `data:image/png;base64,${base64}`, shape: shapeProps, params, context });
    editState.lastBounds = nodeBounds(target);
}

/* ─────────── event handlers ─────────── */
function onSelectionChange() {
  const sel = figma.currentPage.selection;
  editState.node = sel.length === 1 ? sel[0] : null;
  if (editState.node) {
    const params = parseLayerName(editState.node.name);
    if (params) {
      figma.ui.postMessage({ type: 'update-ui-controls', params });
    }
  }
}

function onDocumentChange(ev: DocumentChangeEvent) {
  if (!editState.node) return;

  const now = nodeBounds(editState.node);
  if (boundsEqual(now, editState.lastBounds)) return;

  const params = parseLayerName(editState.node.name);
  if (params) {
    captureAndSend(editState.node, params, 'update');
  }
}

/* register global listeners */
figma.on('selectionchange', onSelectionChange);

// Ensure pages are loaded before we use `documentchange`
(async () => {
  await figma.loadAllPagesAsync();
  figma.on('documentchange', onDocumentChange);
})();

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

  if (msg.type === 'apply-liquid-glass') {
    if (editState.node) {
      captureAndSend(editState.node, msg.params, 'apply');
    } else {
      figma.notify("Please select a shape first.");
    }
    return;
  }

  /* ───────────────── apply image as background ───────────── */
  if (msg.type === 'apply-image-fill') {
    const node = editState.node; // Use the currently tracked node
    if (!node || !('fills' in node) || !('strokes' in node) || !('effects' in node)) return;

    const base64 = msg.data.split(',')[1];
    const bytes  = figma.base64Decode(base64);
    const image  = figma.createImage(bytes);

    const imagePaint: ImagePaint = {
      type: 'IMAGE',
      imageHash: image.hash,
      scaleMode: 'FILL',     // no transform needed – image already trimmed
      visible: true
    };

    node.fills = [imagePaint];

    // On manual apply, set styles and rename layer. On update, do nothing more.
    if (msg.context === 'apply') {
      node.strokeWeight = 2;
      node.strokes = [{
        type: 'GRADIENT_ANGULAR',
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: [
          { position: 0.12, color: { r: 1, g: 1, b: 1, a: 1.0 } },
          { position: 0.28, color: { r: 1, g: 1, b: 1, a: 0.1 } },
          { position: 0.36, color: { r: 1, g: 1, b: 1, a: 0.1 } },
          { position: 0.64, color: { r: 1, g: 1, b: 1, a: 1.0 } },
          { position: 0.78, color: { r: 1, g: 1, b: 1, a: 0.1 } },
          { position: 0.89, color: { r: 1, g: 1, b: 1, a: 0.1 } },
        ],
        visible: true
      }];

      node.effects = [
        { // Inner Shadow
          type: 'INNER_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.7 },
          offset: { x: 12, y: 12 },
          radius: 30,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        },
        { // Drop Shadow
          type: 'DROP_SHADOW',
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 6 },
          radius: 5,
          spread: 0,
          visible: true,
          blendMode: 'NORMAL'
        }
      ];
      node.name = formatLayerName(msg.params);
      figma.notify('Liquid Glass applied');
    } else {
      figma.notify('Background updated');
    }
  }
};