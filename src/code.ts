// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 300, height: 600 });

const OFFSET = 20;

const editState = {
  node: null as FrameNode | null,
  lastBounds: null as { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } | null,
};

// Add missing variables
let isUpdatingAll = false;
let scriptIsMakingChange = false;

function nodeBounds(node: SceneNode): { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } {
  const t = node.absoluteTransform;
  const cornerRadius = 'cornerRadius' in node ? (node as FrameNode | RectangleNode).cornerRadius : 0;
  return { x: t[0][2], y: t[1][2], width: (node as any).width, height: (node as any).height, cornerRadius };
}

function boundsEqual(a: typeof editState.lastBounds, b: typeof editState.lastBounds) {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.cornerRadius === b.cornerRadius;
}

// Enhanced layer name parsing and formatting system
interface RefractionParams {
  edge: number;
  strength: number;
  ca: number;
  frost: number;
}

interface EffectsParams {
  innerShadowX: number;
  innerShadowY: number;
  innerShadowBlur: number;
  innerShadowSpread: number;
  innerShadowOpacity: number;
  strokeAngle: number;
  strokeColor: string;
  strokeThickness: number; // NEW: Stroke thickness for refraction layer
  strokeOpacity: number; // Edge highlight opacity
  highlightStrokeWeight: number;
  highlightBlur: number;
  reflectionColor: string; // Reflection color
  reflectionOpacity: number; // Reflection opacity
  tintColor: string;
  tintOpacity: number; // Tint opacity
  tintBlendMode: string;
}

interface AllParams extends RefractionParams, EffectsParams {}

// Color conversion utilities
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 1, g: 1, b: 1 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Blend mode mappings
const BLEND_MODE_MAP: { [key: string]: BlendMode } = {
  'PASS_THROUGH': 'PASS_THROUGH',
  'NORMAL': 'NORMAL',
  'DARKEN': 'DARKEN',
  'MULTIPLY': 'MULTIPLY',
  'PLUS_DARKER': 'PLUS_DARKER',
  'COLOR_BURN': 'COLOR_BURN',
  'LIGHTEN': 'LIGHTEN',
  'SCREEN': 'SCREEN',
  'PLUS_LIGHTER': 'PLUS_LIGHTER',
  'COLOR_DODGE': 'COLOR_DODGE',
  'OVERLAY': 'OVERLAY',
  'SOFT_LIGHT': 'SOFT_LIGHT',
  'HARD_LIGHT': 'HARD_LIGHT',
  'DIFFERENCE': 'DIFFERENCE',
  'EXCLUSION': 'EXCLUSION',
  'HUE': 'HUE',
  'SATURATION': 'SATURATION',
  'COLOR': 'COLOR',
  'LUMINOSITY': 'LUMINOSITY'
};

// Enhanced parsing functions
function parseLayerName(name: string): RefractionParams | null {
  if (!name.startsWith('[LG - ') || !name.endsWith(']')) return null;
  const paramsStr = name.substring(6, name.length - 1);
  const params: Partial<RefractionParams> = {};
  const parts = paramsStr.split(' ');
  try {
    parts.forEach(part => {
      if (part.startsWith('ET')) params.edge = parseFloat(part.substring(2));
      if (part.startsWith('RS')) params.strength = parseFloat(part.substring(2));
      if (part.startsWith('CA')) params.ca = parseFloat(part.substring(2));
      if (part.startsWith('BB')) params.frost = parseFloat(part.substring(2));
    });
    if (params.edge === undefined || params.strength === undefined || params.ca === undefined || params.frost === undefined) return null;
    return params as RefractionParams;
  } catch (e) {
    return null;
  }
}

function parseRefractionLayerName(name: string): Partial<EffectsParams> | null {
  const match = name.match(/\[Refraction: (.+)\]/);
  if (!match) return null;
  
  try {
    const paramStr = match[1];
    const effects: Partial<EffectsParams> = {};
    
    // Parse inner shadow: IS{x},{y},{blur},{spread},{opacity}
    const isMatch = paramStr.match(/IS([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+),([0-9.]+)/);
    if (isMatch) {
      effects.innerShadowX = parseFloat(isMatch[1]);
      effects.innerShadowY = parseFloat(isMatch[2]);
      effects.innerShadowBlur = parseFloat(isMatch[3]);
      effects.innerShadowSpread = parseFloat(isMatch[4]);
      effects.innerShadowOpacity = parseFloat(isMatch[5]);
    }
    
    // Parse stroke: ST{angle},{color},{thickness},{opacity}
    const stMatch = paramStr.match(/ST([0-9.]+),([A-Fa-f0-9]{6}),([0-9.]+),([0-9.]+)/);
    if (stMatch) {
      effects.strokeAngle = parseFloat(stMatch[1]);
      effects.strokeColor = `#${stMatch[2]}`;
      effects.strokeThickness = parseFloat(stMatch[3]);
      effects.strokeOpacity = parseFloat(stMatch[4]);
    }
    
    return effects;
  } catch (e) {
    return null;
  }
}

function parseReflectionLayerName(name: string): Partial<EffectsParams> | null {
  const match = name.match(/\[Reflection: (.+)\]/);
  if (!match) return null;
  
  try {
    const paramStr = match[1];
    const effects: Partial<EffectsParams> = {};
    
    // Parse stroke weight: SW{weight}
    const swMatch = paramStr.match(/SW([0-9.]+)/);
    if (swMatch) {
      effects.highlightStrokeWeight = parseFloat(swMatch[1]);
    }
    
    // Parse blur: BL{blur}
    const blMatch = paramStr.match(/BL([0-9.]+)/);
    if (blMatch) {
      effects.highlightBlur = parseFloat(blMatch[1]);
    }
    
    // Parse color: C{color}
    const cMatch = paramStr.match(/C([A-Fa-f0-9]{6})/);
    if (cMatch) {
      effects.reflectionColor = `#${cMatch[1]}`;
    }
    
    // Parse opacity: O{opacity}
    const oMatch = paramStr.match(/O([0-9.]+)/);
    if (oMatch) {
      effects.reflectionOpacity = parseFloat(oMatch[1]);
    }
    
    return effects;
  } catch (e) {
    return null;
  }
}

function parseTintLayerName(name: string): Partial<EffectsParams> | null {
  const match = name.match(/\[Tint: (.+)\]/);
  if (!match) return null;
  
  try {
    const paramStr = match[1];
    const effects: Partial<EffectsParams> = {};
    
    // Parse color: C{color}
    const cMatch = paramStr.match(/C([A-Fa-f0-9]{6})/);
    if (cMatch) {
      effects.tintColor = `#${cMatch[1]}`;
    }
    
    // Parse opacity: O{opacity}
    const oMatch = paramStr.match(/O([0-9.]+)/);
    if (oMatch) {
      effects.tintOpacity = parseFloat(oMatch[1]);
    }
    
    // Parse blend mode: BM{mode}
    const bmMatch = paramStr.match(/BM([A-Z_]+)/);
    if (bmMatch) {
      effects.tintBlendMode = bmMatch[1];
    }
    
    return effects;
  } catch (e) {
    return null;
  }
}

// Enhanced formatting functions
function formatLayerName(params: RefractionParams): string {
  const et = `ET${params.edge}`;
  const rs = `RS${params.strength}`;
  const ca = `CA${params.ca}`;
  const bb = `BB${params.frost}`;
  return `[LG - ${et} ${rs} ${ca} ${bb}]`;
}

function formatRefractionLayerName(effects: Partial<EffectsParams>): string {
  const x = effects.innerShadowX ?? 10;
  const y = effects.innerShadowY ?? 10;
  const blur = effects.innerShadowBlur ?? 10;
  const spread = effects.innerShadowSpread ?? 0;
  const opacity = effects.innerShadowOpacity ?? 40;
  const angle = effects.strokeAngle ?? 0;
  const color = (effects.strokeColor ?? '#ffffff').replace('#', '');
  const thickness = effects.strokeThickness ?? 1;
  const strokeOpacity = effects.strokeOpacity ?? 100;
  
  return `[Refraction: IS${x},${y},${blur},${spread},${opacity} ST${angle},${color},${thickness},${strokeOpacity}]`;
}

function formatReflectionLayerName(effects: Partial<EffectsParams>): string {
  const weight = effects.highlightStrokeWeight ?? 12;
  const blur = effects.highlightBlur ?? 14;
  const color = (effects.reflectionColor ?? '#ffffff').replace('#', '');
  const opacity = effects.reflectionOpacity ?? 100;
  
  return `[Reflection: SW${weight} BL${blur} C${color} O${opacity}]`;
}

function formatTintLayerName(effects: Partial<EffectsParams>): string {
  const color = (effects.tintColor ?? '#ffffff').replace('#', '');
  const opacity = effects.tintOpacity ?? 20;
  const blendMode = effects.tintBlendMode ?? 'NORMAL';
  
  return `[Tint: C${color} O${opacity} BM${blendMode}]`;
}

// Apply effects to layers
function applyRefractionEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
  if (!('effects' in layer) || !('strokes' in layer) || !('strokeWeight' in layer)) return;
  
  const innerShadowEffect: Effect = {
    type: 'INNER_SHADOW',
    color: { r: 0, g: 0, b: 0, a: (effects.innerShadowOpacity ?? 40) / 100 },
    offset: { x: effects.innerShadowX ?? 10, y: effects.innerShadowY ?? 10 },
    radius: effects.innerShadowBlur ?? 10,
    spread: effects.innerShadowSpread ?? 0,
    visible: true,
    blendMode: 'NORMAL'
  };
  
  layer.effects = [innerShadowEffect];
  
  // Apply stroke thickness
  layer.strokeWeight = effects.strokeThickness ?? 1;
  layer.strokeAlign = 'OUTSIDE';
  
  // Apply stroke with gradient
  const strokeColor = hexToRgb(effects.strokeColor ?? '#ffffff');
  const strokeOpacity = (effects.strokeOpacity ?? 100) / 100;
  const angle = (effects.strokeAngle ?? 0) * Math.PI / 180;
  
  // Create rotation matrix for gradient
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gradientTransform: Transform = [[cos, -sin, 0.5], [sin, cos, 0.5]];
  
  layer.strokes = [{
    type: 'GRADIENT_ANGULAR',
    gradientTransform,
    gradientStops: [
      { position: 0.12, color: { ...strokeColor, a: strokeOpacity } },
      { position: 0.28, color: { ...strokeColor, a: strokeOpacity * 0.4 } },
      { position: 0.36, color: { ...strokeColor, a: strokeOpacity * 0.4 } },
      { position: 0.64, color: { ...strokeColor, a: strokeOpacity } },
      { position: 0.78, color: { ...strokeColor, a: strokeOpacity * 0.4 } },
      { position: 0.89, color: { ...strokeColor, a: strokeOpacity * 0.4 } },
    ],
  }];
}

function applyReflectionEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
  if (!('effects' in layer) || !('strokeWeight' in layer) || !('strokes' in layer)) return;
  
  layer.strokeWeight = effects.highlightStrokeWeight ?? 12;
   layer.strokeAlign = 'CENTER';
  
  const blurEffect: Effect = {
    type: 'LAYER_BLUR',
    blurType: 'NORMAL',
    radius: effects.highlightBlur ?? 14,
    visible: true
  };
  
  layer.effects = [blurEffect];
  
  // Apply highlight stroke with configurable color and opacity
  const strokeColor = hexToRgb(effects.reflectionColor ?? '#ffffff');
  const strokeOpacity = (effects.reflectionOpacity ?? 100) / 100;
  
  layer.strokes = [{
    type: 'GRADIENT_ANGULAR',
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
    gradientStops: [
      { position: 0.12, color: { ...strokeColor, a: strokeOpacity } },
      { position: 0.28, color: { ...strokeColor, a: 0.0 } },
      { position: 0.36, color: { ...strokeColor, a: 0.0 } },
      { position: 0.64, color: { ...strokeColor, a: strokeOpacity } },
      { position: 0.78, color: { ...strokeColor, a: 0.0 } },
      { position: 0.89, color: { ...strokeColor, a: 0.0 } },
    ],
  }];
}

function applyTintEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
  if (!('fills' in layer) || !('blendMode' in layer)) return;
  
  const tintColor = hexToRgb(effects.tintColor ?? '#ffffff');
  const tintOpacity = (effects.tintOpacity ?? 20) / 100;
  
  layer.fills = [{ 
    type: 'SOLID', 
    color: tintColor, 
    opacity: tintOpacity
  }];
  
  const blendMode = BLEND_MODE_MAP[effects.tintBlendMode ?? 'NORMAL'] || 'NORMAL';
  layer.blendMode = blendMode;
}

// Extract effects from existing LG element
function extractEffectsFromLgElement(lgElement: FrameNode): Partial<EffectsParams> {
  const effects: Partial<EffectsParams> = {};
  
  // Extract from refraction layer
  const refractionLayer = lgElement.findOne(n => n.name.includes('Refraction'));
  if (refractionLayer) {
    const parsed = parseRefractionLayerName(refractionLayer.name);
    if (parsed) Object.assign(effects, parsed);
  }
  
  // Extract from highlight reflection
  const highlightGroup = lgElement.findOne(n => n.name === 'Highlight group') as FrameNode;
  if (highlightGroup) {
    const reflection = highlightGroup.findOne(n => n.name.includes('Reflection'));
    if (reflection) {
      const parsed = parseReflectionLayerName(reflection.name);
      if (parsed) Object.assign(effects, parsed);
    }
  }
  
  // Extract from tint layer
  const tintGroup = lgElement.findOne(n => n.name === 'tint group') as FrameNode;
  if (tintGroup) {
    const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
    if (tintLayer) {
      const parsed = parseTintLayerName(tintLayer.name);
      if (parsed) Object.assign(effects, parsed);
    }
  }
  
  return effects;
}

// Enhanced update function
async function updateLgElement(node: FrameNode, params: AllParams, context: 'create' | 'update') {
  const refractionLayer = node.findOne(n => n.name.includes('Refraction'));
  if (!refractionLayer) return;

  // Get current properties from main frame
  const width = node.width;
  const height = node.height;
  const cornerRadius = typeof node.cornerRadius === 'number' ? node.cornerRadius : 0;

  // Update refraction layer name and effects
  refractionLayer.name = formatRefractionLayerName(params);
  applyRefractionEffects(refractionLayer, params);

  // Update tint layer
  const tintGroup = node.findOne(n => n.name === 'tint group') as FrameNode | null;
  if (tintGroup) {
    const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
    if (tintLayer) {
      tintLayer.name = formatTintLayerName(params);
      applyTintEffects(tintLayer, params);
    }
  }

  // Update highlight reflection - FIX: Use correct layer name search
  const highlightGroup = node.findOne(n => n.name === 'Highlight group') as FrameNode | null;
  if (highlightGroup) {
    const reflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
    if (reflection) {
      reflection.name = formatReflectionLayerName(params);
      applyReflectionEffects(reflection, params);
    }
  }

  // For complex shapes (vector refraction layer), all elements should already be positioned at origin
  if (refractionLayer.type === 'VECTOR') {
    // For vector shapes, the refraction layer should stay at origin (0,0) within the frame
    // All masks and highlights should also be at origin since they're clones
    
    // Update tint group
    if (tintGroup) {
      tintGroup.resize(width, height);
      const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
      const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
      
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
    if (highlightGroup) {
      highlightGroup.resize(width, height);
      const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
      const highlightReflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
      
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
    if (tintGroup) {
      tintGroup.resize(width, height);
      const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
      const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
      
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
    
    if (highlightGroup) {
      highlightGroup.resize(width, height);
      const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
      const highlightReflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
      
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

  // Update main frame name with refraction params only
  node.name = formatLayerName(params);
  
  // Only capture and send if this is an update context (property changes)
  if (context === 'update') {
    await captureAndSend(node, params, node.id);
  }
}

// Enhanced selection change handler
async function onSelectionChange() {
  const sel = figma.currentPage.selection;
  
  if (sel.length === 1 && sel[0].type === 'FRAME' && parseLayerName(sel[0].name)) {
    // Selected a single LG element
    editState.node = sel[0];
    editState.lastBounds = nodeBounds(editState.node);
    const refractionParams = parseLayerName(editState.node.name);
    const effectsParams = extractEffectsFromLgElement(editState.node);
    
    if (refractionParams) {
      figma.ui.postMessage({ 
        type: 'update-ui-controls', 
        params: refractionParams, 
        effectsParams: effectsParams,
        isSelected: true,
        isMultipleSelection: false
      });
      captureAndSend(editState.node, { ...refractionParams, ...effectsParams });
    }
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: true, canApplyEffect: false });
    
  } else if (sel.length > 1) {
    // Multiple selection - check if any are LG elements
    const lgElements = sel.filter(node => node.type === 'FRAME' && parseLayerName(node.name)) as FrameNode[];
    
    if (lgElements.length > 0) {
      // Multiple LG elements selected
      editState.node = null;
      editState.lastBounds = null;
      
      // For multiple selection, we could show average values or "Multiple values"
      // For now, just show default values and indicate multiple selection
      const defaultParams = { edge: 20, strength: 25, ca: 5, frost: 0 };
      const defaultEffects = {
        innerShadowX: 10, innerShadowY: 10, innerShadowBlur: 10, innerShadowSpread: 0, innerShadowOpacity: 40,
        strokeAngle: 0, strokeColor: '#ffffff', strokeThickness: 1, strokeOpacity: 100,
        highlightStrokeWeight: 12, highlightBlur: 14,
        reflectionColor: '#ffffff', reflectionOpacity: 100,
        tintColor: '#ffffff', tintOpacity: 20, tintBlendMode: 'NORMAL'
      };
      
      figma.ui.postMessage({ 
        type: 'update-ui-controls', 
        params: defaultParams,
        effectsParams: defaultEffects,
        isSelected: true,
        isMultipleSelection: true
      });
      figma.ui.postMessage({ type: 'selection-changed', isLgElement: true, canApplyEffect: false, isMultipleSelection: true });
    } else {
      // Multiple non-LG elements
      editState.node = null;
      editState.lastBounds = null;
      figma.ui.postMessage({ type: 'selection-changed', isLgElement: false, canApplyEffect: false, isMultipleSelection: true });
    }
    
  } else if (sel.length === 1 && !parseLayerName(sel[0].name)) {
    // Selected a single non-LG element - can apply effect
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: false, canApplyEffect: true });
  } else {
    // No selection
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-cleared' });
  }
}

// Enhanced message handler
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
    } else if (msg.type === 'update-effects-realtime') {
      console.log('Real-time effects update:', msg.parameterName, msg.parameterValue);
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) return;
      
      // Find all LG elements in selection (including nested)
      const lgElements = findLgElementsInSelection(selection);
      
      if (lgElements.length === 0) {
        console.log('No LG elements found in selection for real-time update');
        return;
      }
      
      // Update only the specific parameter for all LG elements
      for (const lgElement of lgElements) {
        await updateSingleEffectParameter(lgElement, msg.parameterName, msg.parameterValue);
      }
      
      console.log(`Updated ${msg.parameterName} for ${lgElements.length} LG elements`);
    } else if (msg.type === 'apply-image-fill') {
      console.log('Applying image fill to node:', msg.nodeId);
      const nodeToFill = await figma.getNodeByIdAsync(msg.nodeId) as FrameNode;
      if (nodeToFill) {
        const refractionLayer = nodeToFill.findOne(n => n.name.includes('Refraction')) as GeometryMixin;
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
    } else if (msg.type === 'update-selection-lg-elements') {
      console.log('Updating LG elements in selection');
      if (isUpdatingAll) return;
      isUpdatingAll = true;
      scriptIsMakingChange = true;

      const originalViewport = { center: figma.viewport.center, zoom: figma.viewport.zoom };
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) {
        figma.notify("Please select elements containing Liquid Glass components.", { error: true });
        isUpdatingAll = false;
        scriptIsMakingChange = false;
        return;
      }
      
      const lgNodes = findLgElementsInSelection(selection);
      
      if (lgNodes.length === 0) {
        figma.notify("No Liquid Glass elements found in selection.");
        isUpdatingAll = false;
        scriptIsMakingChange = false;
        return;
      }

      let notification = figma.notify(`Updating ${lgNodes.length} element(s) in selection...`);

      try {
        for (let i = 0; i < lgNodes.length; i++) {
          if (!isUpdatingAll) {
            throw new Error("Update process was interrupted by the user.");
          }
          const node = lgNodes[i];
          notification.cancel();
          notification = figma.notify(`Updating ${i + 1} of ${lgNodes.length}: ${node.name}`);
          
          // Use the parameters from the UI - this updates refraction parameters only
          await updateLgElement(node, msg.params, 'update');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        notification.cancel();
        figma.notify(`Successfully updated ${lgNodes.length} element(s) in selection.`);
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
          
          const refractionParams = parseLayerName(node.name);
          const effectsParams = extractEffectsFromLgElement(node);
          if (refractionParams) {
            await captureAndSend(node, { ...refractionParams, ...effectsParams }, node.id);
            await new Promise(resolve => setTimeout(resolve, 100));
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
    } else if (msg.type === 'preview-effects') {
      // Handle blend mode preview (optional enhancement)
      console.log('Previewing effects:', msg.params);
      if (editState.node) {
        // Temporarily apply effects for preview
        // This would need careful implementation to avoid disrupting the actual state
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    figma.notify('An error occurred: ' + (error instanceof Error ? error.message : String(error)), { error: true });
  }
};

// New function to update a single effect parameter
async function updateSingleEffectParameter(lgElement: FrameNode, parameterName: string, parameterValue: any) {
  // Extract current effects parameters
  const currentEffects = extractEffectsFromLgElement(lgElement);
  
  // Update only the specific parameter
  currentEffects[parameterName as keyof EffectsParams] = parameterValue;
  
  // Apply the change to the appropriate layer
  if (parameterName.startsWith('innerShadow') || parameterName.startsWith('stroke')) {
    // Update refraction layer
    const refractionLayer = lgElement.findOne(n => n.name.includes('Refraction'));
    if (refractionLayer) {
      refractionLayer.name = formatRefractionLayerName(currentEffects);
      applyRefractionEffects(refractionLayer, currentEffects);
    }
  } else if (parameterName.startsWith('highlight') || parameterName.startsWith('reflection')) {
    // Update highlight reflection layer
    const highlightGroup = lgElement.findOne(n => n.name === 'Highlight group') as FrameNode;
    if (highlightGroup) {
      const reflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
      if (reflection) {
        reflection.name = formatReflectionLayerName(currentEffects);
        applyReflectionEffects(reflection, currentEffects);
      }
    }
  } else if (parameterName.startsWith('tint')) {
    // Update tint layer
    const tintGroup = lgElement.findOne(n => n.name === 'tint group') as FrameNode;
    if (tintGroup) {
      const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
      if (tintLayer) {
        tintLayer.name = formatTintLayerName(currentEffects);
        applyTintEffects(tintLayer, currentEffects);
      }
    }
  }
}

// ...existing code...

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

async function createLgElement(params: AllParams) {
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
  refractionLayer.name = formatRefractionLayerName(params);
  refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  refractionLayer.resize(200, 100);
  refractionLayer.cornerRadius = 50;
  mainFrame.appendChild(refractionLayer);
  
  // Apply refraction effects (including stroke thickness)
  applyRefractionEffects(refractionLayer, params);

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
  tintLayer.name = formatTintLayerName(params);
  tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  tintLayer.resize(200, 100);
  tintGroup.appendChild(tintLayer);
  
  // Apply tint effects
  applyTintEffects(tintLayer, params);
  
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
  highlightReflection.name = formatReflectionLayerName(params);
  highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
  highlightReflection.fills = [];
  highlightReflection.resize(200, 100);
  highlightReflection.cornerRadius = 50;
  highlightGroup.appendChild(highlightReflection);
  
  // Apply reflection effects
  applyReflectionEffects(highlightReflection, params);

  // Set mask as the first child
  highlightGroup.children[0].isMask = true;

  figma.currentPage.selection = [mainFrame];
  // Use 'create' context to trigger capture and send
  await updateLgElement(mainFrame, params, 'create');
  await captureAndSend(mainFrame, params, mainFrame.id);
}

function getShapeType(node: SceneNode): 'rectangle' | 'ellipse' | 'complex' {
  if (node.type === 'RECTANGLE' && ('rotation' in node ? node.rotation === 0 : true)) return 'rectangle';
  if (node.type === 'ELLIPSE' && ('rotation' in node ? node.rotation === 0 : true)) return 'ellipse';
  return 'complex';
}

async function createOrUpdateLgFromSelection(params: AllParams) {
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
      flattened.name = formatRefractionLayerName(params);
      flattened.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      flattened.x = 0; // At origin within main frame
      flattened.y = 0; // At origin within main frame
      
      // Apply stroke effects to the refraction layer
      applyRefractionEffects(flattened, params);
      
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
      tintLayer.name = formatTintLayerName(params);
      tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      tintLayer.resize(flattenedBounds.width, flattenedBounds.height);
      tintLayer.x = 0;
      tintLayer.y = 0;
      tintGroup.appendChild(tintLayer);
      
      // Apply tint effects
      applyTintEffects(tintLayer, params);
      
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
      highlightReflection.name = formatReflectionLayerName(params);
      highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
      highlightReflection.fills = [];
      highlightReflection.x = 0;
      highlightReflection.y = 0;
      
      // Apply highlight stroke effects
      applyReflectionEffects(highlightReflection, params);
      
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
    refractionLayer.name = formatRefractionLayerName(params);
    refractionLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    refractionLayer.resize(mainFrame.width, mainFrame.height);
    
    if (selectedNode.type === 'RECTANGLE' && refractionLayer.type === 'RECTANGLE') {
      refractionLayer.cornerRadius = cornerRadius;
    }

    // Apply refraction layer effects
    applyRefractionEffects(refractionLayer, params);
    
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
    tintLayer.name = formatTintLayerName(params);
    tintLayer.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    tintLayer.resize(mainFrame.width, mainFrame.height);
    tintGroup.appendChild(tintLayer);

    // Apply tint effects
    applyTintEffects(tintLayer, params);

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
    highlightReflection.name = formatReflectionLayerName(params);
    highlightReflection.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    highlightReflection.fills = [];
    highlightReflection.resize(mainFrame.width, mainFrame.height);
    
    if (selectedNode.type === 'RECTANGLE' && highlightReflection.type === 'RECTANGLE') {
      highlightReflection.cornerRadius = cornerRadius;
    }
    
    // Apply reflection effects
    applyReflectionEffects(highlightReflection, params);
    
    highlightGroup.appendChild(highlightReflection);

    // Set mask
    highlightGroup.children[0].isMask = true;
    
    // Remove original shape from canvas
    selectedNode.remove();
    
    figma.currentPage.selection = [mainFrame];
    // Use 'create' context and then capture
    await updateLgElement(mainFrame, params, 'create');
    await captureAndSend(mainFrame, params, mainFrame.id);
  }
}

// Type definition for bounding box
type BoundingBox = { x: number; y: number; width: number; height: number };

// Helper function to get node bounding box
function getNodeBounds(node: SceneNode): BoundingBox {
  const transform = node.absoluteTransform;
  const width = 'width' in node ? node.width : 0;
  const height = 'height' in node ? node.height : 0;
  return {
    x: transform[0][2],
    y: transform[1][2],
    width,
    height
  };
}

// Helper function to check if two bounding boxes overlap
function boundingBoxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.x + a.width <= b.x || 
           b.x + b.width <= a.x || 
           a.y + a.height <= b.y || 
           b.y + b.height <= a.y);
}

// Helper function to check if node A is above node B in layer order (within same parent)
function isNodeAboveInLayer(nodeA: SceneNode, nodeB: SceneNode, parent: FrameNode | PageNode): boolean {
  if (!parent || !('children' in parent)) return false;
  
  const indexA = parent.children.indexOf(nodeA as any);
  const indexB = parent.children.indexOf(nodeB as any);
  
  // If either node is not found in parent, they're not siblings
  if (indexA === -1 || indexB === -1) return false;
  
  // Higher index = higher in layer stack (rendered on top)
  return indexA > indexB;
}

// Simplified function to find nodes to hide for image capture
function getOverlappingNodesAbove(lgElement: FrameNode): { node: SceneNode, originalOpacity: number }[] {
  const nodesToHide: { node: SceneNode, originalOpacity: number }[] = [];
  const lgBounds = getNodeBounds(lgElement);
  
  // Check siblings of the LG element
  const lgParent = lgElement.parent;
  if (lgParent && 'children' in lgParent && lgParent.children.length > 1) {
    for (const sibling of lgParent.children) {
      if (sibling === lgElement || !sibling.visible) continue;
      
      const siblingBounds = getNodeBounds(sibling);
      if (boundingBoxesOverlap(lgBounds, siblingBounds) && 
          isNodeAboveInLayer(sibling, lgElement, lgParent)) {
        nodesToHide.push({ node: sibling, originalOpacity: sibling.opacity });
      }
    }
  }
  
  // Check siblings of the parent of the LG element (only if parent exists and has a parent)
  if (lgParent && 
      lgParent.parent && 
      'children' in lgParent.parent && 
      lgParent.parent.children.length > 1) {
    
    const grandParent = lgParent.parent;
    const parentBounds = getNodeBounds(lgParent as SceneNode);
    
    for (const parentSibling of grandParent.children) {
      if (parentSibling === lgParent || !parentSibling.visible) continue;
      
      const parentSiblingBounds = getNodeBounds(parentSibling);
      if (boundingBoxesOverlap(parentBounds, parentSiblingBounds) && 
          isNodeAboveInLayer(parentSibling, lgParent as SceneNode, grandParent)) {
        nodesToHide.push({ node: parentSibling, originalOpacity: parentSibling.opacity });
      }
    }
  }
  
  // Check great-grandparent level if needed (for deeply nested structures)
  if (lgParent && 
      lgParent.parent && 
      lgParent.parent.parent && 
      'children' in lgParent.parent.parent &&
      lgParent.parent.parent.children.length > 1) {
    
    const greatGrandParent = lgParent.parent.parent;
    const grandParentBounds = getNodeBounds(lgParent.parent as SceneNode);
    
    for (const greatParentSibling of greatGrandParent.children) {
      if (greatParentSibling === lgParent.parent || !greatParentSibling.visible) continue;
      
      const greatParentSiblingBounds = getNodeBounds(greatParentSibling);
      if (boundingBoxesOverlap(grandParentBounds, greatParentSiblingBounds) && 
          isNodeAboveInLayer(greatParentSibling, lgParent.parent as SceneNode, greatGrandParent)) {
        nodesToHide.push({ node: greatParentSibling, originalOpacity: greatParentSibling.opacity });
      }
    }
  }
  
  console.log(`Found ${nodesToHide.length} overlapping nodes above LG element`);
  return nodesToHide;
}

async function captureAndSendComplex(target: FrameNode, params: any, svgData?: string, nodeId: string = target.id) {
  const { width, height } = target;
  const captureRect = { x: target.absoluteTransform[0][2] - OFFSET, y: target.absoluteTransform[1][2] - OFFSET, width: width + OFFSET * 2, height: height + OFFSET * 2 };

  // Get overlapping nodes above the LG element using simplified approach
  const nodesToRestore = getOverlappingNodesAbove(target);
  
  // Hide the target node itself
  nodesToRestore.push({ node: target, originalOpacity: target.opacity });
  target.opacity = 0;
  
  // Hide all overlapping nodes above the LG element
  for (const { node } of nodesToRestore) {
    if (node !== target) {
      node.opacity = 0;
    }
  }

  const slice = figma.createSlice();
  slice.x = captureRect.x;
  slice.y = captureRect.y;
  slice.resize(captureRect.width, captureRect.height);
  figma.currentPage.appendChild(slice);

  const bytes = await slice.exportAsync({
    format: 'PNG',
  });

  slice.remove();

  // Restore opacity of all hidden nodes
  for (const { node, originalOpacity } of nodesToRestore) {
    node.opacity = originalOpacity;
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

async function captureAndSend(target: FrameNode, params: any, nodeId: string = target.id) {
  const refractionLayer = target.findOne(n => n.name.includes('Refraction'));
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
      await captureSimpleShape(target, params, nodeId);
    }
  } else {
    // Use existing capture method for simple shapes
    await captureSimpleShape(target, params, nodeId);
  }
}

async function captureSimpleShape(target: FrameNode, params: any, nodeId: string) {
  const { width, height } = target;
  const captureRect = { x: target.absoluteTransform[0][2] - OFFSET, y: target.absoluteTransform[1][2] - OFFSET, width: width + OFFSET * 2, height: height + OFFSET * 2 };

  // Get overlapping nodes above the LG element using simplified approach
  const nodesToRestore = getOverlappingNodesAbove(target);
  
  // Hide the target node itself
  nodesToRestore.push({ node: target, originalOpacity: target.opacity });
  target.opacity = 0;
  
  // Hide all overlapping nodes above the LG element
  for (const { node } of nodesToRestore) {
    if (node !== target) {
      node.opacity = 0;
    }
  }

  const slice = figma.createSlice();
  slice.x = captureRect.x;
  slice.y = captureRect.y;
  slice.resize(captureRect.width, captureRect.height);
  figma.currentPage.appendChild(slice);

  const bytes = await slice.exportAsync({
    format: 'PNG',
  });

  slice.remove();

  // Restore opacity of all hidden nodes
  for (const { node, originalOpacity } of nodesToRestore) {
    node.opacity = originalOpacity;
  }

  const refractionLayer = target.findOne(n => n.name.includes('Refraction'));
  const shapeType = refractionLayer ? getShapeType(refractionLayer) : 'rectangle';
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
  const refractionLayer = node.findOne(n => n.name.includes('Refraction'));
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

  // Update tint group elements
  const tintGroup = node.findOne(n => n.name === 'tint group') as FrameNode | null;
  if (tintGroup) {
    tintGroup.resize(width, height);
    const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
    const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
    
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

  // Update highlight group elements - FIX: Use correct layer name search
  const highlightGroup = node.findOne(n => n.name === 'Highlight group') as FrameNode | null;
  if (highlightGroup) {
    highlightGroup.resize(width, height);
    const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
    const highlightReflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
    
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

  // Update content frame
  const contentFrame = node.findOne(n => n.name === 'Content') as FrameNode | null;
  if (contentFrame) {
    contentFrame.resize(width, height);
  }

  // Update using the improved updateLgElement function
  const refractionParams = parseLayerName(editState.node.name);
  const effectsParams = extractEffectsFromLgElement(editState.node);
  if (refractionParams) {
    // Use 'update' context to trigger capture and send
    updateLgElement(node, { ...refractionParams, ...effectsParams }, 'update');
  }
  
  // Update last bounds
  editState.lastBounds = now;
}

// Helper function to find all LG elements within a selection (including nested)
function findLgElementsInSelection(nodes: readonly SceneNode[]): FrameNode[] {
  const lgElements: FrameNode[] = [];
  
  function traverse(node: SceneNode) {
    // Check if this node is an LG element
    if (node.type === 'FRAME' && parseLayerName(node.name)) {
      lgElements.push(node);
    }
    
    // Recursively check children
    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }
  
  for (const node of nodes) {
    traverse(node);
  }
  
  return lgElements;
}