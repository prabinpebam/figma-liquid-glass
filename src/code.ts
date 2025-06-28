// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 320, height: 500 });

const OFFSET = 20;

const editState = {
  node: null as FrameNode | null,
  lastBounds: null as { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } | null,
};

function nodeBounds(node: SceneNode): { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } {
  const t = node.absoluteTransform;
  const cornerRadius = 'cornerRadius' in node ? (node as FrameNode | RectangleNode).cornerRadius : 0;
  return { x: t[0][2], y: t[1][2], width: (node as any).width, height: (node as any).height, cornerRadius };
}

function boundsEqual(a: typeof editState.lastBounds, b: typeof editState.lastBounds) {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.cornerRadius === b.cornerRadius;
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
  mainFrame.resize(200, 100);
  mainFrame.cornerRadius = 50;
  mainFrame.clipsContent = true;
  mainFrame.x = figma.viewport.center.x - 100;
  mainFrame.y = figma.viewport.center.y - 50;

  const refractionLayer = figma.createRectangle();
  refractionLayer.name = "Refraction layer";
  refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  refractionLayer.resize(200, 100);
  refractionLayer.cornerRadius = 50;
  mainFrame.appendChild(refractionLayer);

  const tintLayer = figma.createRectangle();
  tintLayer.name = "Tint layer";
  tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  tintLayer.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
  tintLayer.resize(200, 100);
  mainFrame.appendChild(tintLayer);

  const contentFrame = figma.createFrame();
  contentFrame.name = "Content";
  contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  contentFrame.fills = [];
  contentFrame.resize(200, 100);
  mainFrame.appendChild(contentFrame);

  const highlightFrame = figma.createFrame();
  highlightFrame.name = "Highlight layer";
  highlightFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightFrame.clipsContent = true;
  highlightFrame.fills = [];
  highlightFrame.resize(200, 100);
  mainFrame.appendChild(highlightFrame);

  const highlightReflection = figma.createRectangle();
  highlightReflection.name = "Highlight reflection";
  highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 24, visible: true }];
  highlightReflection.fills = [];
  highlightReflection.resize(200, 100);
  highlightReflection.cornerRadius = 50;
  highlightFrame.appendChild(highlightReflection);

  figma.currentPage.selection = [mainFrame];
  await updateLgElement(mainFrame, params, 'create');
}

async function updateLgElement(node: FrameNode, params: any, context: 'create' | 'update') {
  const refractionLayer = node.findOne(n => n.name === 'Refraction layer') as RectangleNode;
  if (!refractionLayer) return;

  const cornerRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;
  refractionLayer.cornerRadius = cornerRadius;
  const highlightFrame = node.findOne(n => n.name === 'Highlight layer') as FrameNode | null;
  if (highlightFrame) {
    highlightFrame.cornerRadius = cornerRadius;
    const highlightReflection = highlightFrame.findOne(n => n.name === 'Highlight reflection' && 'cornerRadius' in n) as RectangleNode | null;
    if (highlightReflection) {
      highlightReflection.cornerRadius = cornerRadius;
    }
  }

  if (context === 'create') {
    node.effects = [
      { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 3, y: 6 }, radius: 10, spread: 0, visible: true, blendMode: 'NORMAL' }
    ];

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
      { type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.4 }, offset: { x: 10, y: 10 }, radius: 10, spread: 0, visible: true, blendMode: 'NORMAL' },
    ];
    const highlightReflection = node.findOne(n => n.name === 'Highlight reflection') as RectangleNode | null;
    if (highlightReflection) {
      highlightReflection.strokes = [{
        type: 'GRADIENT_ANGULAR',
        gradientTransform: [[1, 0, 0], [0, 1, 0]],
        gradientStops: [
          { position: 0.12, color: { r: 1, g: 1, b: 1, a: 1.0 } },
          { position: 0.28, color: { r: 1, g: 1, b: 1, a: 0.0 } },
          { position: 0.36, color: { r: 1, g: 1, b: 1, a: 0.0 } },
          { position: 0.64, color: { r: 1, g: 1, b: 1, a: 1.0 } },
          { position: 0.78, color: { r: 1, g: 1, b: 1, a: 0.0 } },
          { position: 0.89, color: { r: 1, g: 1, b: 1, a: 0.0 } },
        ],
      }];
      highlightReflection.strokeWeight = 8;
      highlightReflection.strokeAlign = 'CENTER';
    }
  }

  node.name = formatLayerName(params);
  await captureAndSend(node, params);
}

async function captureAndSend(target: FrameNode, params: any, nodeId: string = target.id) {
  const { width, height } = target;
  const captureRect = { x: target.absoluteTransform[0][2] - OFFSET, y: target.absoluteTransform[1][2] - OFFSET, width: width + OFFSET * 2, height: height + OFFSET * 2 };

  const nodesToRestore: { node: SceneNode, visible: boolean }[] = [];
  
  // Hide the target node itself to capture what's behind it
  nodesToRestore.push({ node: target, visible: target.visible });
  target.visible = false;

  const slice = figma.createSlice();
  slice.x = captureRect.x;
  slice.y = captureRect.y;
  slice.resize(captureRect.width, captureRect.height);
  figma.currentPage.appendChild(slice);

  const bytes = await slice.exportAsync({
    format: 'PNG',
  });

  slice.remove();

  // Restore visibility of all hidden nodes
  for (const { node, visible } of nodesToRestore) {
    node.visible = visible;
  }

  const shapeProps = { width, height, cornerRadius: typeof target.cornerRadius === 'number' ? target.cornerRadius : 0 };
  figma.ui.postMessage({ type: 'image-captured', data: `data:image/png;base64,${figma.base64Encode(bytes)}`, shape: shapeProps, params, nodeId });
  if (editState.node && editState.node.id === target.id) {
    editState.lastBounds = nodeBounds(target);
  }
}

function onSelectionChange() {
  const sel = figma.currentPage.selection;
  if (sel.length === 1 && sel[0].type === 'FRAME' && parseLayerName(sel[0].name)) {
    editState.node = sel[0];
    editState.lastBounds = nodeBounds(editState.node);
    const params = parseLayerName(editState.node.name);
    if (params) {
      figma.ui.postMessage({ type: 'update-ui-controls', params, isSelected: true });
      captureAndSend(editState.node, params);
    }
  } else {
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-cleared' });
  }
}

function onDocumentChange() {
  if (!editState.node) return;
  const now = nodeBounds(editState.node);
  if (boundsEqual(now, editState.lastBounds)) return;

  // Propagate corner radius changes to children
  const node = editState.node;
  if (typeof node.cornerRadius === 'number') {
    const cornerRadius = node.cornerRadius;
    const refractionLayer = node.findOne(n => n.name === 'Refraction layer' && 'cornerRadius' in n) as RectangleNode | null;
    if (refractionLayer) {
      refractionLayer.cornerRadius = cornerRadius;
    }
    const highlightFrame = node.findOne(n => n.name === 'Highlight layer' && 'cornerRadius' in n) as FrameNode | null;
    if (highlightFrame) {
      highlightFrame.cornerRadius = cornerRadius;
      const highlightReflection = highlightFrame.findOne(n => n.name === 'Highlight reflection' && 'cornerRadius' in n) as RectangleNode | null;
      if (highlightReflection) {
        highlightReflection.cornerRadius = cornerRadius;
      }
    }
  }

  const params = parseLayerName(editState.node.name);
  if (params) {
    captureAndSend(editState.node, params);
  }
}

let isUpdatingAll = false;
let scriptIsMakingChange = false;

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-lg-element') {
    await createLgElement(msg.params);
  } else if (msg.type === 'update-lg-element') {
    if (editState.node) {
      await updateLgElement(editState.node, msg.params, 'update');
    }
  } else if (msg.type === 'apply-image-fill') {
    const nodeToFill = await figma.getNodeByIdAsync(msg.nodeId) as FrameNode;
    if (nodeToFill) {
      const refractionLayer = nodeToFill.findOne(n => n.name === 'Refraction layer') as RectangleNode;
      if (refractionLayer) {
        const base64 = msg.data.split(',')[1];
        const bytes = figma.base64Decode(base64);
        const image = figma.createImage(bytes);
        refractionLayer.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
      }
    }
  } else if (msg.type === 'update-all-lg-elements') {
    if (isUpdatingAll) return;
    isUpdatingAll = true;
    scriptIsMakingChange = true;

    const originalViewport = { center: figma.viewport.center, zoom: figma.viewport.zoom };
    const lgNodes = figma.currentPage.findAll(n => n.type === 'FRAME' && !!parseLayerName(n.name)) as FrameNode[];
    
    if (lgNodes.length === 0) {
      figma.notify("No Liquid Glass elements found on this page.");
      isUpdatingAll = false;
      return;
    }

    let notification = figma.notify(`Updating ${lgNodes.length} element(s)...`);

    try {
      for (let i = 0; i < lgNodes.length; i++) {
        if (!isUpdatingAll) {
          throw new Error("Update process was interrupted by the user.");
        }
        const node = lgNodes[i];
        notification.cancel();
        notification = figma.notify(`Updating ${i + 1} of ${lgNodes.length}: ${node.name}`);
        
        const params = parseLayerName(node.name);
        if (params) {
          figma.viewport.scrollAndZoomIntoView([node]);
          await captureAndSend(node, params, node.id);
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for UI to process
        }
      }
      notification.cancel();
      figma.notify(`Successfully updated ${lgNodes.length} element(s).`);
    } catch (e) {
      notification.cancel();
      const message = e instanceof Error ? e.message : String(e);
      figma.notify(`Update stopped: ${message}`, { error: true });
    } finally {
      figma.viewport.center = originalViewport.center;
      figma.viewport.zoom = originalViewport.zoom;
      isUpdatingAll = false;
      scriptIsMakingChange = false;
    }
  }
};

(async () => {
  await figma.loadAllPagesAsync();
  figma.on('documentchange', () => {
    if (scriptIsMakingChange) return; // Ignore changes made by the script itself

    if (isUpdatingAll) {
      isUpdatingAll = false; // Interrupt batch update if user makes a change
    }
    onDocumentChange();
  });
  figma.on('selectionchange', onSelectionChange);
})();