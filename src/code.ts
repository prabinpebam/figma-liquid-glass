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
  mainFrame.clipsContent = false;
  mainFrame.fills = []; // Ensure no fill
  mainFrame.x = figma.viewport.center.x - 100;
  mainFrame.y = figma.viewport.center.y - 50;

  // Main frame effects
  mainFrame.effects = [
    { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 6 }, radius: 5, spread: 0, visible: true, blendMode: 'NORMAL' }
  ];

  // Create layers in the correct order (bottom to top)
  
  // 1. Refraction layer (bottom)
  const refractionLayer = figma.createRectangle();
  refractionLayer.name = "Refraction layer";
  refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  refractionLayer.resize(200, 100);
  refractionLayer.cornerRadius = 50;
  refractionLayer.strokeWeight = 1;
  refractionLayer.strokeAlign = 'INSIDE';
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
  mainFrame.appendChild(refractionLayer);

  // 2. Tint group
  const tintGroup = figma.createFrame();
  tintGroup.name = "tint group";
  tintGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  tintGroup.clipsContent = true;
  tintGroup.fills = [];
  tintGroup.resize(200, 100);
  mainFrame.appendChild(tintGroup);

  // Shape mask goes first (bottom)
  const tintMask = figma.createRectangle();
  tintMask.name = "Shape mask";
  tintMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  tintMask.strokes = [];
  tintMask.resize(200, 100);
  tintMask.cornerRadius = 50;
  tintGroup.appendChild(tintMask);

  // Tint layer goes on top
  const tintLayer = figma.createRectangle();
  tintLayer.name = "Tint layer";
  tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  tintLayer.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
  tintLayer.resize(200, 100);
  tintGroup.appendChild(tintLayer);
  
  // Set mask as the first child
  tintGroup.children[0].isMask = true;

  // 3. Content layer
  const contentFrame = figma.createFrame();
  contentFrame.name = "Content";
  contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  contentFrame.fills = [];
  contentFrame.clipsContent = false;
  contentFrame.resize(200, 100);
  mainFrame.appendChild(contentFrame);

  // 4. Highlight group (top)
  const highlightGroup = figma.createFrame();
  highlightGroup.name = "Highlight group";
  highlightGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightGroup.clipsContent = true;
  highlightGroup.fills = [];
  highlightGroup.resize(200, 100);
  mainFrame.appendChild(highlightGroup);

  // Shape mask goes first (bottom)
  const highlightMask = figma.createRectangle();
  highlightMask.name = "Shape mask";
  highlightMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
  highlightMask.strokes = [];
  highlightMask.resize(200, 100);
  highlightMask.cornerRadius = 50;
  highlightGroup.appendChild(highlightMask);

  // Highlight reflection goes on top
  const highlightReflection = figma.createRectangle();
  highlightReflection.name = "Highlight reflection";
  highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 14, visible: true }];
  highlightReflection.fills = [];
  highlightReflection.resize(200, 100);
  highlightReflection.cornerRadius = 50;
  highlightReflection.strokeWeight = 12;
  highlightReflection.strokeAlign = 'CENTER';
  highlightReflection.strokes = [{
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
  highlightGroup.appendChild(highlightReflection);

  // Set mask as the first child
  highlightGroup.children[0].isMask = true;

  figma.currentPage.selection = [mainFrame];
  await updateLgElement(mainFrame, params, 'create');
}

async function updateLgElement(node: FrameNode, params: any, context: 'create' | 'update') {
  const refractionLayer = node.findOne(n => n.name === 'Refraction layer');
  if (!refractionLayer) return;

  // Get current properties from main frame
  const width = node.width;
  const height = node.height;
  const cornerRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;

  // For complex shapes (vector refraction layer), all elements should already be positioned at origin
  if (refractionLayer.type === 'VECTOR') {
    // For vector shapes, the refraction layer should stay at origin (0,0) within the frame
    // All masks and highlights should also be at origin since they're clones
    
    // Update tint group
    const tintGroup = node.findOne(n => n.name === 'tint group') as FrameNode | null;
    if (tintGroup) {
      tintGroup.resize(width, height);
      const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
      const tintLayer = tintGroup.findOne(n => n.name === 'Tint layer');
      
      if (tintMask && tintMask.type === 'VECTOR') {
        // Vector mask should maintain position at origin and scale with frame
        tintMask.x = 0;
        tintMask.y = 0;
        // Vector scaling is handled automatically by constraints
      }
      
      if (tintLayer) {
        tintLayer.resize(width, height);
        tintLayer.x = 0;
        tintLayer.y = 0;
      }
    }
    
    // Update highlight group
    const highlightGroup = node.findOne(n => n.name === 'Highlight group') as FrameNode | null;
    if (highlightGroup) {
      highlightGroup.resize(width, height);
      const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
      const highlightReflection = highlightGroup.findOne(n => n.name === 'Highlight reflection');
      
      if (highlightMask && highlightMask.type === 'VECTOR') {
        highlightMask.x = 0;
        highlightMask.y = 0;
        // Vector scaling is handled automatically by constraints
      }
      
      if (highlightReflection && highlightReflection.type === 'VECTOR') {
        highlightReflection.x = 0;
        highlightReflection.y = 0;
        // Vector scaling is handled automatically by constraints
      }
    }
  } else {
    // Handle simple shapes (rectangles/ellipses) as before
    if (refractionLayer.type === 'RECTANGLE') {
      const rect = refractionLayer as RectangleNode;
      rect.resize(width, height);
      rect.cornerRadius = cornerRadius;
    } else if (refractionLayer.type === 'ELLIPSE') {
      refractionLayer.resize(width, height);
    }
    
    // Update all shape masks to match refraction layer
    const tintGroup = node.findOne(n => n.name === 'tint group') as FrameNode | null;
    if (tintGroup) {
      tintGroup.resize(width, height);
      const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
      const tintLayer = tintGroup.findOne(n => n.name === 'Tint layer');
      
      if (tintMask) {
        tintMask.resize(width, height);
        if (tintMask.type === 'RECTANGLE') {
          (tintMask as RectangleNode).cornerRadius = cornerRadius;
        }
      }
      
      if (tintLayer) {
        tintLayer.resize(width, height);
      }
    }
    
    const highlightGroup = node.findOne(n => n.name === 'Highlight group') as FrameNode | null;
    if (highlightGroup) {
      highlightGroup.resize(width, height);
      const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
      const highlightReflection = highlightGroup.findOne(n => n.name === 'Highlight reflection');
      
      if (highlightMask) {
        highlightMask.resize(width, height);
        if (highlightMask.type === 'RECTANGLE') {
          (highlightMask as RectangleNode).cornerRadius = cornerRadius;
        }
      }
      
      if (highlightReflection) {
        highlightReflection.resize(width, height);
        if (highlightReflection.type === 'RECTANGLE') {
          (highlightReflection as RectangleNode).cornerRadius = cornerRadius;
        }
      }
    }
  }

  // Update content frame
  const contentFrame = node.findOne(n => n.name === 'Content') as FrameNode | null;
  if (contentFrame) {
    contentFrame.resize(width, height);
  }

  node.name = formatLayerName(params);
  await captureAndSend(node, params);
}

function getShapeType(node: SceneNode): 'rectangle' | 'ellipse' | 'complex' {
  if (node.type === 'RECTANGLE' && ('rotation' in node ? node.rotation === 0 : true)) return 'rectangle';
  if (node.type === 'ELLIPSE' && ('rotation' in node ? node.rotation === 0 : true)) return 'ellipse';
  return 'complex';
}

async function createOrUpdateLgFromSelection(params: any) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const selectedNode = selection[0];
  const shapeType = getShapeType(selectedNode);
  
  if (shapeType === 'complex') {
    // Complex shape workflow - flatten FIRST, then use its bounds
    const flattened = figma.flatten([selectedNode]);
    if (!flattened || flattened.type !== 'VECTOR') {
      figma.notify("Failed to process complex shape", { error: true });
      return;
    }
    
    // Use flattened shape's bounds for everything - this is the actual bounding box
    const flattenedBounds = {
      x: flattened.x,
      y: flattened.y,
      width: flattened.width,
      height: flattened.height
    };
    
    try {
      const svgData = await flattened.exportAsync({ 
        format: 'SVG',
        svgOutlineText: false,
        svgIdAttribute: true,
        svgSimplifyStroke: true
      });
      
      let svgString = '';
      for (let i = 0; i < svgData.length; i++) {
        svgString += String.fromCharCode(svgData[i]);
      }
      
      // Create LG element using flattened shape's exact bounds
      const mainFrame = figma.createFrame();
      mainFrame.name = formatLayerName(params);
      mainFrame.resize(flattenedBounds.width, flattenedBounds.height);
      mainFrame.x = flattenedBounds.x;
      mainFrame.y = flattenedBounds.y;
      mainFrame.clipsContent = false;
      mainFrame.fills = []; // Ensure no fill
      
      // Main frame effects
      mainFrame.effects = [
        { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 6 }, radius: 5, spread: 0, visible: true, blendMode: 'NORMAL' }
      ];

      // Position flattened shape at origin within the main frame (since main frame matches its bounds)
      flattened.name = "Refraction layer";
      flattened.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      flattened.x = 0; // At origin within main frame
      flattened.y = 0; // At origin within main frame
      
      // Apply stroke effects to the refraction layer
      if ('strokes' in flattened) {
        flattened.strokeWeight = 1;
        flattened.strokeAlign = 'INSIDE';
        flattened.strokes = [{
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
      }
      
      if ('effects' in flattened) {
        flattened.effects = [
          { type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.4 }, offset: { x: 10, y: 10 }, radius: 10, spread: 0, visible: true, blendMode: 'NORMAL' },
        ];
      }
      
      mainFrame.appendChild(flattened);
      
      // 2. Tint group - uses main frame dimensions
      const tintGroup = figma.createFrame();
      tintGroup.name = "tint group";
      tintGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      tintGroup.clipsContent = true;
      tintGroup.fills = [];
      tintGroup.resize(flattenedBounds.width, flattenedBounds.height);
      mainFrame.appendChild(tintGroup);

      // Shape mask - clone the refraction layer for exact match
      const tintMask = flattened.clone();
      tintMask.name = "Shape mask";
      tintMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      tintMask.strokes = [];
      tintMask.effects = [];
      // Position at origin within tint group (same as refraction layer)
      tintMask.x = 0;
      tintMask.y = 0;
      tintGroup.appendChild(tintMask);

      // Tint layer - covers entire frame
      const tintLayer = figma.createRectangle();
      tintLayer.name = "Tint layer";
      tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      tintLayer.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
      tintLayer.resize(flattenedBounds.width, flattenedBounds.height);
      tintLayer.x = 0;
      tintLayer.y = 0;
      tintGroup.appendChild(tintLayer);
      
      // Set mask
      tintGroup.children[0].isMask = true;

      // 3. Content layer
      const contentFrame = figma.createFrame();
      contentFrame.name = "Content";
      contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      contentFrame.fills = [];
      contentFrame.clipsContent = false;
      contentFrame.resize(flattenedBounds.width, flattenedBounds.height);
      mainFrame.appendChild(contentFrame);
      
      // 4. Highlight group
      const highlightGroup = figma.createFrame();
      highlightGroup.name = "Highlight group";
      highlightGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      highlightGroup.clipsContent = true;
      highlightGroup.fills = [];
      highlightGroup.resize(flattenedBounds.width, flattenedBounds.height);
      mainFrame.appendChild(highlightGroup);

      // Shape mask - clone the refraction layer for exact match
      const highlightMask = flattened.clone();
      highlightMask.name = "Shape mask";
      highlightMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      highlightMask.strokes = [];
      highlightMask.effects = [];
      // Position at origin within highlight group (same as refraction layer)
      highlightMask.x = 0;
      highlightMask.y = 0;
      highlightGroup.appendChild(highlightMask);

      // Highlight reflection - clone and apply effects
      const highlightReflection = flattened.clone();
      highlightReflection.name = "Highlight reflection";
      highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 14, visible: true }];
      highlightReflection.fills = [];
      highlightReflection.x = 0;
      highlightReflection.y = 0;
      
      // Apply highlight stroke effects
      if ('strokes' in highlightReflection) {
        highlightReflection.strokeWeight = 12;
        highlightReflection.strokeAlign = 'CENTER';
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
      }
      
      highlightGroup.appendChild(highlightReflection);

      // Set mask
      highlightGroup.children[0].isMask = true;
      
      figma.currentPage.selection = [mainFrame];
      await captureAndSendComplex(mainFrame, params, svgString);
      
    } catch (error) {
      console.error('Error exporting SVG:', error);
      figma.notify('Error processing complex shape: ' + (error instanceof Error ? error.message : String(error)), { error: true });
      return;
    }
    
  } else {
    // Simple shape workflow - create structure for rectangles/ellipses
    const mainFrame = figma.createFrame();
    mainFrame.name = formatLayerName(params);
    mainFrame.resize(selectedNode.width, selectedNode.height);
    mainFrame.x = selectedNode.x;
    mainFrame.y = selectedNode.y;
    mainFrame.clipsContent = false;
    mainFrame.fills = []; // Ensure no fill
    
    const cornerRadius = selectedNode.type === 'RECTANGLE' ? selectedNode.cornerRadius : 0;
    if (selectedNode.type === 'RECTANGLE') {
      mainFrame.cornerRadius = cornerRadius;
    }

    // Main frame effects
    mainFrame.effects = [
      { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 6 }, radius: 5, spread: 0, visible: true, blendMode: 'NORMAL' }
    ];
    
    // Create refraction layer matching the shape type
    const refractionLayer = selectedNode.type === 'ELLIPSE' 
      ? figma.createEllipse() 
      : figma.createRectangle();
    refractionLayer.name = "Refraction layer";
    refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    refractionLayer.resize(mainFrame.width, mainFrame.height);
    
    if (selectedNode.type === 'RECTANGLE' && refractionLayer.type === 'RECTANGLE') {
      refractionLayer.cornerRadius = cornerRadius;
    }

    // Apply refraction layer effects
    if (refractionLayer.type === 'RECTANGLE') {
      const rectLayer = refractionLayer as RectangleNode;
      rectLayer.strokeWeight = 1;
      rectLayer.strokeAlign = 'INSIDE';
      rectLayer.strokes = [{
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
      rectLayer.effects = [
        { type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.4 }, offset: { x: 10, y: 10 }, radius: 10, spread: 0, visible: true, blendMode: 'NORMAL' },
      ];
    } else if (refractionLayer.type === 'ELLIPSE') {
      const ellipseLayer = refractionLayer as EllipseNode;
      ellipseLayer.strokeWeight = 1;
      ellipseLayer.strokeAlign = 'INSIDE';
      ellipseLayer.strokes = [{
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
      ellipseLayer.effects = [
        { type: 'INNER_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.4 }, offset: { x: 10, y: 10 }, radius: 10, spread: 0, visible: true, blendMode: 'NORMAL' },
      ];
    }
    
    mainFrame.appendChild(refractionLayer);
    
    // Create tint group
    const tintGroup = figma.createFrame();
    tintGroup.name = "tint group";
    tintGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    tintGroup.clipsContent = true;
    tintGroup.fills = [];
    tintGroup.resize(mainFrame.width, mainFrame.height);
    mainFrame.appendChild(tintGroup);

    // Shape mask goes first (bottom)
    const tintMask = selectedNode.type === 'ELLIPSE' 
      ? figma.createEllipse() 
      : figma.createRectangle();
    tintMask.name = "Shape mask";
    tintMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    tintMask.strokes = [];
    tintMask.resize(mainFrame.width, mainFrame.height);
    
    if (selectedNode.type === 'RECTANGLE' && tintMask.type === 'RECTANGLE') {
      tintMask.cornerRadius = cornerRadius;
    }
    
    tintGroup.appendChild(tintMask);

    // Tint layer goes on top
    const tintLayer = figma.createRectangle();
    tintLayer.name = "Tint layer";
    tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    tintLayer.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.2 }];
    tintLayer.resize(mainFrame.width, mainFrame.height);
    tintGroup.appendChild(tintLayer);

    // Set mask
    tintGroup.children[0].isMask = true;

    // Content layer
    const contentFrame = figma.createFrame();
    contentFrame.name = "Content";
    contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    contentFrame.fills = [];
    contentFrame.clipsContent = false;
    contentFrame.resize(mainFrame.width, mainFrame.height);
    mainFrame.appendChild(contentFrame);

    // Create highlight group
    const highlightGroup = figma.createFrame();
    highlightGroup.name = "Highlight group";
    highlightGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    highlightGroup.clipsContent = true;
    highlightGroup.fills = [];
    highlightGroup.resize(mainFrame.width, mainFrame.height);
    mainFrame.appendChild(highlightGroup);
    
    // Shape mask goes first (bottom)
    const highlightMask = selectedNode.type === 'ELLIPSE' 
      ? figma.createEllipse() 
      : figma.createRectangle();
    highlightMask.name = "Shape mask";
    highlightMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    highlightMask.strokes = [];
    highlightMask.resize(mainFrame.width, mainFrame.height);
    
    if (selectedNode.type === 'RECTANGLE' && highlightMask.type === 'RECTANGLE') {
      highlightMask.cornerRadius = cornerRadius;
    }
    
    highlightGroup.appendChild(highlightMask);

    // Create highlight reflection on top
    const highlightReflection = selectedNode.type === 'ELLIPSE' 
      ? figma.createEllipse() 
      : figma.createRectangle();
    highlightReflection.name = "Highlight reflection";
    highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    highlightReflection.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: 14, visible: true }];
    highlightReflection.fills = [];
    highlightReflection.resize(mainFrame.width, mainFrame.height);
    highlightReflection.strokeWeight = 12;
    highlightReflection.strokeAlign = 'CENTER';
    highlightReflection.strokes = [{
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
    
    if (selectedNode.type === 'RECTANGLE' && highlightReflection.type === 'RECTANGLE') {
      highlightReflection.cornerRadius = cornerRadius;
    }
    
    highlightGroup.appendChild(highlightReflection);

    // Set mask
    highlightGroup.children[0].isMask = true;
    
    // Remove original shape from canvas
    selectedNode.remove();
    
    figma.currentPage.selection = [mainFrame];
    await updateLgElement(mainFrame, params, 'create');
  }
}

async function captureAndSendComplex(target: FrameNode, params: any, svgData?: string, nodeId: string = target.id) {
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
  const shapeType = svgData ? 'complex' : getShapeType(target);
  
  figma.ui.postMessage({ 
    type: 'image-captured', 
    data: `data:image/png;base64,${figma.base64Encode(bytes)}`, 
    shape: shapeProps, 
    shapeType,
    svgData,
    params, 
    nodeId 
  });
  
  if (editState.node && editState.node.id === target.id) {
    editState.lastBounds = nodeBounds(target);
  }
}

function isSimpleShape(node: SceneNode): boolean {
  if (node.type !== 'RECTANGLE' && node.type !== 'ELLIPSE') return false;
  if ('rotation' in node && node.rotation !== 0) return false;
  return true;
}

async function captureAndSend(target: FrameNode, params: any, nodeId: string = target.id) {
  const refractionLayer = target.findOne(n => n.name === 'Refraction layer');
  const shapeType = refractionLayer ? getShapeType(refractionLayer) : 'rectangle';
  
  if (shapeType === 'complex' && refractionLayer?.type === 'VECTOR') {
    // Export vector as SVG for complex shapes
    try {
      const svgData = await refractionLayer.exportAsync({ 
        format: 'SVG',
        svgOutlineText: false,
        svgIdAttribute: true,
        svgSimplifyStroke: true
      });
      
      // Convert Uint8Array to string manually
      let svgString = '';
      for (let i = 0; i < svgData.length; i++) {
        svgString += String.fromCharCode(svgData[i]);
      }
      
      await captureAndSendComplex(target, params, svgString, nodeId);
    } catch (error) {
      console.error('Error exporting vector SVG:', error);
      // Fallback to simple shape rendering if SVG export fails
      const { width, height } = target;
      const captureRect = { x: target.absoluteTransform[0][2] - OFFSET, y: target.absoluteTransform[1][2] - OFFSET, width: width + OFFSET * 2, height: height + OFFSET * 2 };

      const nodesToRestore: { node: SceneNode, visible: boolean }[] = [];
      
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

      for (const { node, visible } of nodesToRestore) {
        node.visible = visible;
      }

      const shapeProps = { width, height, cornerRadius: typeof target.cornerRadius === 'number' ? target.cornerRadius : 0 };
      figma.ui.postMessage({ 
        type: 'image-captured', 
        data: `data:image/png;base64,${figma.base64Encode(bytes)}`, 
        shape: shapeProps, 
        shapeType: 'rectangle', // Fallback to rectangle rendering
        params, 
        nodeId 
      });
      
      if (editState.node && editState.node.id === target.id) {
        editState.lastBounds = nodeBounds(target);
      }
    }
  } else {
    // Use existing capture method for simple shapes
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
    figma.ui.postMessage({ 
      type: 'image-captured', 
      data: `data:image/png;base64,${figma.base64Encode(bytes)}`, 
      shape: shapeProps, 
      shapeType,
      params, 
      nodeId 
    });
    
    if (editState.node && editState.node.id === target.id) {
      editState.lastBounds = nodeBounds(target);
    }
  }
}

function onSelectionChange() {
  const sel = figma.currentPage.selection;
  if (sel.length === 1 && sel[0].type === 'FRAME' && parseLayerName(sel[0].name)) {
    // Selected an LG element
    editState.node = sel[0];
    editState.lastBounds = nodeBounds(editState.node);
    const params = parseLayerName(editState.node.name);
    if (params) {
      figma.ui.postMessage({ type: 'update-ui-controls', params, isSelected: true });
      captureAndSend(editState.node, params);
    }
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: true, canApplyEffect: false });
  } else if (sel.length === 1 && !parseLayerName(sel[0].name)) {
    // Selected a non-LG element - can apply effect
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: false, canApplyEffect: true });
  } else {
    // No selection or multiple selection
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-cleared' });
  }
}

function onDocumentChange() {
  if (!editState.node) return;
  
  const now = nodeBounds(editState.node);
  if (boundsEqual(now, editState.lastBounds)) return;

  console.log('LG element properties changed, updating...');
  
  // Get current node reference
  const node = editState.node;
  
  // Update all child elements to match the main frame's properties
  const width = node.width;
  const height = node.height;
  const cornerRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;

  // Update refraction layer
  const refractionLayer = node.findOne(n => n.name === 'Refraction layer');
  if (refractionLayer) {
    if (refractionLayer.type === 'VECTOR') {
      // For vector shapes, maintain proportional positioning
      // The vector shape should maintain its relative position and scale
      // This is handled in updateLgElement
    } else {
      refractionLayer.resize(width, height);
      if (refractionLayer.type === 'RECTANGLE') {
        (refractionLayer as RectangleNode).cornerRadius = cornerRadius;
      }
    }
  }

  // Update using the improved updateLgElement function
  const params = parseLayerName(editState.node.name);
  if (params) {
    updateLgElement(node, params, 'update');
  }
  
  // Update last bounds
  editState.lastBounds = now;
}

let isUpdatingAll = false;
let scriptIsMakingChange = false;

figma.ui.onmessage = async (msg) => {
  console.log('Plugin received message:', msg.type, msg);
  
  try {
    if (msg.type === 'create-lg-element') {
      console.log('Creating LG element with params:', msg.params);
      figma.notify('Creating liquid glass element...');
      await createLgElement(msg.params);
      figma.notify('Liquid glass element created!');
    } else if (msg.type === 'apply-effect-to-selection') {
      console.log('Applying effect to selection with params:', msg.params);
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        figma.notify('Please select a shape to apply the effect to', { error: true });
        return;
      }
      figma.notify('Applying effect to selection...');
      await createOrUpdateLgFromSelection(msg.params);
      figma.notify('Effect applied!');
    } else if (msg.type === 'update-lg-element') {
      console.log('Updating LG element');
      if (editState.node) {
        await updateLgElement(editState.node, msg.params, 'update');
      } else {
        console.log('No LG element selected to update');
      }
    } else if (msg.type === 'apply-image-fill') {
      console.log('Applying image fill to node:', msg.nodeId);
      const nodeToFill = await figma.getNodeByIdAsync(msg.nodeId) as FrameNode;
      if (nodeToFill) {
        const refractionLayer = nodeToFill.findOne(n => n.name === 'Refraction layer') as GeometryMixin;
        if (refractionLayer && 'fills' in refractionLayer) {
          const base64 = msg.data.split(',')[1];
          const bytes = figma.base64Decode(base64);
          const image = figma.createImage(bytes);
          refractionLayer.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
          console.log('Applied image fill successfully');
        } else {
          console.log('Could not find refraction layer');
        }
      } else {
        console.log('Could not find node to fill');
      }
    } else if (msg.type === 'update-all-lg-elements') {
      console.log('Updating all LG elements');
      if (isUpdatingAll) return;
      isUpdatingAll = true;
      scriptIsMakingChange = true;

      const originalViewport = { center: figma.viewport.center, zoom: figma.viewport.zoom };
      const lgNodes = figma.currentPage.findAll(n => n.type === 'FRAME' && !!parseLayerName(n.name)) as FrameNode[];
      
      if (lgNodes.length === 0) {
        figma.notify("No Liquid Glass elements found on this page.");
        isUpdatingAll = false;
        scriptIsMakingChange = false;
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
    } else {
      console.log('Unknown message type:', msg.type);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    figma.notify('An error occurred: ' + (error instanceof Error ? error.message : String(error)), { error: true });
  }
};

(async () => {
  console.log('Plugin initializing...');
  await figma.loadAllPagesAsync();
  
  figma.on('documentchange', () => {
    if (scriptIsMakingChange) return; // Ignore changes made by the script itself

    if (isUpdatingAll) {
      isUpdatingAll = false; // Interrupt batch update if user makes a change
    }
    onDocumentChange();
  });
  
  figma.on('selectionchange', onSelectionChange);
  
  // Send initial state to UI with a delay to ensure UI is ready
  setTimeout(() => {
    console.log('Sending plugin-ready message to UI');
    figma.ui.postMessage({ type: 'plugin-ready' });
  }, 100);
  
  console.log('Plugin initialized successfully');
})();

export {};