// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 400 });

const OFFSET = 20;

const editState = {
  node: null as FrameNode | null,
  lastBounds: null as { x: number; y: number; width: number; height: number } | null,
};

function nodeBounds(node: SceneNode) {
  const t = node.absoluteTransform;
  return { x: t[0][2], y: t[1][2], width: (node as any).width, height: (node as any).height };
}

function boundsEqual(a: typeof editState.lastBounds, b: typeof editState.lastBounds) {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function rectsIntersect(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return !(a.x > b.x + b.width || a.x + a.width < b.x || a.y > b.y + b.height || a.y + a.height < b.y);
}

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

async function createLgElement(params: any) {
  const mainFrame = figma.createFrame();
  mainFrame.name = formatLayerName(params);
  mainFrame.resize(150, 50);
  mainFrame.clipsContent = false;
  mainFrame.x = figma.viewport.center.x - 75;
  mainFrame.y = figma.viewport.center.y - 25;

  const refractionLayer = figma.createRectangle();
  refractionLayer.name = "Refraction layer";
  refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  refractionLayer.resize(150, 50);
  mainFrame.appendChild(refractionLayer);

  const tintLayer = figma.createRectangle();
  tintLayer.name = "Tint layer";
  tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  tintLayer.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
  tintLayer.resize(150, 50);
  mainFrame.appendChild(tintLayer);

  const contentFrame = figma.createFrame();
  contentFrame.name = "Content";
  contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  contentFrame.fills = [];
  contentFrame.resize(150, 50);
  mainFrame.appendChild(contentFrame);

  const highlightFrame = figma.createFrame();
  highlightFrame.name = "Highlight layer";
  highlightFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightFrame.clipsContent = true;
  highlightFrame.fills = [];
  highlightFrame.resize(150, 50);
  mainFrame.appendChild(highlightFrame);

  const highlightReflection = figma.createRectangle();
  highlightReflection.name = "Highlight reflection";
  highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 9, visible: true }];
  highlightReflection.fills = [];
  highlightReflection.resize(150, 50);
  highlightFrame.appendChild(highlightReflection);

  figma.currentPage.selection = [mainFrame];
  await updateLgElement(mainFrame, params, 'create');
}

async function updateLgElement(node: FrameNode, params: any, context: 'create' | 'update') {
  const refractionLayer = node.findOne(n => n.name === 'Refraction layer') as RectangleNode;
  if (!refractionLayer) return;

  if (context === 'create') {
    refractionLayer.strokeWeight = 1;
    refractionLayer.strokes = [{
      type: 'GRADIENT_ANGULAR',
      gradientTransform: [[1, 0, 0], [0, 1, 0]],
      gradientStops: [
        { position: 0.12, color: { r: 1, g: 1, b: 1, a: 1.0 } },
        { position: 0.28, color: { r: 1, g: 1, b: 1, a: 0.4 } },
        { position: 0.36, color: { r: 1, g: 1, b: 1, a: 0.4 } },
        { position: 0.64, color: { r: 1, g: 1, b: 1, a: 1.0 } },
        { position: 0.78, color: { r: 1, g: 1, b: 1, a: 0.4 } },
        { position: 0.89, color: { r: 1, g: 1, b: 1, a: 0.4 } },
      ],
    }];
    refractionLayer.effects = [
      { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 6 }, radius: 5, visible: true, blendMode: 'NORMAL' },
      { type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.4 }, offset: { x: 10, y: 10 }, radius: 10, visible: true, blendMode: 'NORMAL' },
    ];
    const highlightReflection = node.findOne(n => n.name === 'Highlight reflection') as RectangleNode;
    if (highlightReflection) {
      highlightReflection.strokes = JSON.parse(JSON.stringify(refractionLayer.strokes));
      highlightReflection.strokeWeight = 3;
      highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 9, visible: true }];
    }
  }

  node.name = formatLayerName(params);
  await captureAndSend(node, params);
}

async function captureAndSend(target: FrameNode, params: any) {
  const { width, height } = target;
  const absX = target.absoluteTransform[0][2];
  const absY = target.absoluteTransform[1][2];
  const captureRect = { x: absX - OFFSET, y: absY - OFFSET, width: width + OFFSET * 2, height: height + OFFSET * 2 };

  const nodesToRestore: { node: SceneNode; visible: boolean }[] = [];
  function hide(node: SceneNode) {
    nodesToRestore.push({ node, visible: node.visible });
    node.visible = false;
  }

  const parent = target.parent;
  const siblings = parent ? parent.children : [];
  let foundTarget = false;
  for (const n of siblings) {
    if (n === target) {
      foundTarget = true;
      hide(n);
      continue;
    }
    if (!foundTarget) continue;
    if (!n.visible) continue;
    const b = nodeBounds(n);
    if (rectsIntersect(b, captureRect)) hide(n);
  }

  const slice = figma.createSlice();
  slice.x = captureRect.x;
  slice.y = captureRect.y;
  slice.resizeWithoutConstraints(captureRect.width, captureRect.height);
  const bytes = await slice.exportAsync({ format: 'PNG' });
  slice.remove();

  for (const { node, visible } of nodesToRestore) {
    node.visible = visible;
  }

  const shapeProps = { width, height, cornerRadius: target.cornerRadius || 0 };
  figma.ui.postMessage({ type: 'image-captured', data: `data:image/png;base64,${figma.base64Encode(bytes)}`, shape: shapeProps, params });
  editState.lastBounds = nodeBounds(target);
}

function onSelectionChange() {
  const sel = figma.currentPage.selection;
  if (sel.length === 1 && sel[0].type === 'FRAME' && parseLayerName(sel[0].name)) {
    editState.node = sel[0];
    editState.lastBounds = nodeBounds(editState.node);
    const params = parseLayerName(editState.node.name);
    if (params) {
      figma.ui.postMessage({ type: 'update-ui-controls', params });
    }
  } else {
    editState.node = null;
    editState.lastBounds = null;
  }
}

function onDocumentChange() {
  if (!editState.node) return;
  const now = nodeBounds(editState.node);
  if (boundsEqual(now, editState.lastBounds)) return;
  const params = parseLayerName(editState.node.name);
  if (params) {
    captureAndSend(editState.node, params);
  }
}

figma.on('selectionchange', onSelectionChange);

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-lg-element') {
    await createLgElement(msg.params);
  } else if (msg.type === 'update-lg-element') {
    if (editState.node) {
      await updateLgElement(editState.node, msg.params, 'update');
    }
  } else if (msg.type === 'apply-image-fill') {
    if (editState.node) {
      const refractionLayer = editState.node.findOne(n => n.name === 'Refraction layer') as RectangleNode;
      if (refractionLayer) {
        const image = figma.createImage(figma.base64Decode(msg.data.split(',')[1]));
        refractionLayer.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
      }
    }
  }
};

(async () => {
  await figma.loadAllPagesAsync();
  figma.on('documentchange', onDocumentChange);
})();