import { AllParams } from '../core/types.js';
import { getShapeType } from '../utils/node-bounds.js';
import { formatLayerName, formatRefractionLayerName, formatReflectionLayerName, formatTintLayerName } from '../utils/layer-parser.js';
import { applyRefractionEffects, applyReflectionEffects, applyTintEffects } from './glass-layers.js';
import { captureAndSend, captureAndSendComplex } from './capture.js';

export async function createOrUpdateLgFromSelection(params: AllParams) {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return;

  const selectedNode = selection[0];
  const shapeType = getShapeType(selectedNode);
  
  if (shapeType === 'complex') {
    await createComplexShapeLg(selectedNode, params);
  } else {
    await createSimpleShapeLg(selectedNode, params);
  }
}

async function createComplexShapeLg(selectedNode: SceneNode, params: AllParams) {
  // Complex shape workflow - flatten FIRST, then use its bounds
  const flattened = figma.flatten([selectedNode]);
  if (!flattened || flattened.type !== 'VECTOR') {
    figma.notify("Failed to process complex shape", { error: true });
    return;
  }
  
  // Use flattened shape's bounds for everything
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
    mainFrame.fills = [];
    
    // Main frame effects
    mainFrame.effects = [
      { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 6 }, radius: 5, spread: 0, visible: true, blendMode: 'NORMAL' }
    ];

    // Position flattened shape at origin within the main frame
    flattened.name = formatRefractionLayerName(params);
    flattened.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    flattened.x = 0;
    flattened.y = 0;
    flattened.locked = true; // Lock refraction layer
    
    // Apply stroke effects to the refraction layer
    applyRefractionEffects(flattened, params);
    
    mainFrame.appendChild(flattened);
    
    // Create tint group
    const tintGroup = figma.createFrame();
    tintGroup.name = "tint group";
    tintGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    tintGroup.clipsContent = true;
    tintGroup.fills = [];
    tintGroup.resize(flattenedBounds.width, flattenedBounds.height);
    tintGroup.locked = true; // Lock tint group
    mainFrame.appendChild(tintGroup);

    // Shape mask - clone the refraction layer for exact match
    const tintMask = flattened.clone();
    tintMask.name = "Shape mask";
    tintMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    tintMask.strokes = [];
    tintMask.effects = [];
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

    // Content layer
    const contentFrame = figma.createFrame();
    contentFrame.name = "Content";
    contentFrame.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    contentFrame.fills = [];
    contentFrame.clipsContent = false;
    contentFrame.resize(flattenedBounds.width, flattenedBounds.height);
    mainFrame.appendChild(contentFrame);
    
    // Highlight group
    const highlightGroup = figma.createFrame();
    highlightGroup.name = "Highlight group";
    highlightGroup.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    highlightGroup.clipsContent = true;
    highlightGroup.fills = [];
    highlightGroup.resize(flattenedBounds.width, flattenedBounds.height);
    highlightGroup.locked = true; // Lock highlight group
    mainFrame.appendChild(highlightGroup);

    // Shape mask - clone the refraction layer for exact match
    const highlightMask = flattened.clone();
    highlightMask.name = "Shape mask";
    highlightMask.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
    highlightMask.strokes = [];
    highlightMask.effects = [];
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
}

async function createSimpleShapeLg(selectedNode: SceneNode, params: AllParams) {
  // Simple shape workflow - create structure for rectangles/ellipses
  const mainFrame = figma.createFrame();
  mainFrame.name = formatLayerName(params);
  mainFrame.resize(selectedNode.width, selectedNode.height);
  mainFrame.x = selectedNode.x;
  mainFrame.y = selectedNode.y;
  mainFrame.clipsContent = false;
  mainFrame.fills = [];
  
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
  refractionLayer.locked = true; // Lock refraction layer
  
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
  tintGroup.locked = true; // Lock tint group
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
  highlightGroup.locked = true; // Lock highlight group
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
  await captureAndSend(mainFrame, params, mainFrame.id);
}
