import { AllParams, RefractionParams, EffectsParams } from '../core/types.js';
import { formatLayerName, formatRefractionLayerName, formatReflectionLayerName, formatTintLayerName, parseLayerName, extractEffectsFromLgElement } from '../utils/layer-parser.js';
import { applyRefractionEffects, applyReflectionEffects, applyTintEffects } from './glass-layers.js';
import { captureAndSend } from './capture.js';

export async function createLgElement(params: AllParams) {
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

// Enhanced update function
export async function updateLgElement(node: FrameNode, params: AllParams, context: 'create' | 'update' | 'effects-only') {
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

  // Update highlight reflection
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
    // Update tint group
    if (tintGroup) {
      tintGroup.resize(width, height);
      const tintMask = tintGroup.findOne(n => n.name === 'Shape mask');
      const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
      
      if (tintMask && tintMask.type === 'VECTOR') {
        tintMask.x = 0;
        tintMask.y = 0;
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
      }
      
      if (highlightReflection && highlightReflection.type === 'VECTOR') {
        highlightReflection.x = 0;
        highlightReflection.y = 0;
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
  
  // Only capture and send if this is an update context that needs image capture (not effects-only)
  if (context === 'update') {
    await captureAndSend(node, params, node.id);
  }
}

// Function to analyze multiple LG elements for mixed values
export function analyzeMultipleLgElements(lgElements: FrameNode[]): {
  refractionParams: RefractionParams;
  effectsParams: Partial<EffectsParams>;
  hasMixedValues: { [key: string]: boolean };
} {
  if (lgElements.length === 0) {
    return {
      refractionParams: { edge: 20, strength: 25, ca: 5, frost: 0 },
      effectsParams: {},
      hasMixedValues: {}
    };
  }

  // Get parameters from all elements
  const allRefractionParams: RefractionParams[] = [];
  const allEffectsParams: Partial<EffectsParams>[] = [];

  for (const lgElement of lgElements) {
    const refractionParams = parseLayerName(lgElement.name);
    const effectsParams = extractEffectsFromLgElement(lgElement);
    
    if (refractionParams) {
      allRefractionParams.push(refractionParams);
      allEffectsParams.push(effectsParams);
    }
  }

  if (allRefractionParams.length === 0) {
    return {
      refractionParams: { edge: 20, strength: 25, ca: 5, frost: 0 },
      effectsParams: {},
      hasMixedValues: {}
    };
  }

  // Check for mixed values and get representative values
  const hasMixedValues: { [key: string]: boolean } = {};
  
  // Check refraction parameters
  const firstRefraction = allRefractionParams[0];
  const refractionParams: RefractionParams = { ...firstRefraction };
  
  for (const key in firstRefraction) {
    const values = allRefractionParams.map(p => (p as any)[key]);
    const hasVariation = values.some(v => v !== values[0]);
    if (hasVariation) {
      hasMixedValues[key] = true;
    }
  }

  // Check effects parameters
  const firstEffects = allEffectsParams[0];
  const effectsParams: Partial<EffectsParams> = { ...firstEffects };
  
  // Define all possible effects parameter keys
  const effectsKeys = [
    'innerShadowX', 'innerShadowY', 'innerShadowBlur', 'innerShadowSpread', 'innerShadowOpacity',
    'strokeAngle', 'strokeColor', 'strokeThickness', 'strokeOpacity',
    'highlightStrokeWeight', 'highlightBlur', 'reflectionColor', 'reflectionOpacity',
    'tintColor', 'tintOpacity', 'tintBlendMode'
  ];

  for (const key of effectsKeys) {
    const values = allEffectsParams.map(p => (p as any)[key]).filter(v => v !== undefined);
    if (values.length > 0) {
      const hasVariation = values.some(v => v !== values[0]);
      if (hasVariation) {
        hasMixedValues[key] = true;
      }
      // Use first non-undefined value as representative
      if (!effectsParams.hasOwnProperty(key)) {
        (effectsParams as any)[key] = values[0];
      }
    }
  }

  return { refractionParams, effectsParams, hasMixedValues };
}