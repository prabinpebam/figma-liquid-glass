// Import necessary modules and functions
import { editState } from '../core/state.js';
import { nodeBounds, boundsEqual } from '../utils/node-bounds.js';
import { parseLayerName, extractEffectsFromLgElement, findLgElementsInSelection } from '../utils/layer-parser.js';
import { analyzeMultipleLgElements, updateLgElement } from '../effects/liquid-glass.js';
import { updateSingleEffectParameter } from '../effects/glass-layers.js';
import { captureAndSend } from '../effects/capture.js';

export async function onSelectionChange() {
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
        isMultipleSelection: false,
        hasMixedValues: {} // No mixed values for single selection
      });
      await captureAndSend(editState.node, { ...refractionParams, ...effectsParams });
    }
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: true, canApplyEffect: false, isMultipleSelection: false });
    
  } else if (sel.length > 1) {
    // Multiple selection - find all LG elements in the selection
    const lgElements = findLgElementsInSelection(sel);
    
    if (lgElements.length > 0) {
      // Multiple LG elements found
      editState.node = null;
      editState.lastBounds = null;
      
      // Analyze all LG elements to detect mixed values
      const analysis = analyzeMultipleLgElements(lgElements);
      
      figma.ui.postMessage({ 
        type: 'update-ui-controls', 
        params: analysis.refractionParams,
        effectsParams: analysis.effectsParams,
        isSelected: true,
        isMultipleSelection: true,
        hasMixedValues: analysis.hasMixedValues,
        lgElementCount: lgElements.length
      });
      figma.ui.postMessage({ 
        type: 'selection-changed', 
        isLgElement: true, 
        canApplyEffect: false, 
        isMultipleSelection: true,
        lgElementCount: lgElements.length
      });
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
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: false, canApplyEffect: true, isMultipleSelection: false });
  } else {
    // No selection
    editState.node = null;
    editState.lastBounds = null;
    figma.ui.postMessage({ type: 'selection-cleared' });
  }
}

export function onDocumentChange() {
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
      // The vector shape should stay at origin (0,0) within the frame
      // Vector scaling is handled automatically by constraints
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
      if (tintMask.type === 'VECTOR') {
        // Vector mask should maintain position at origin and scale with frame
        tintMask.x = 0;
        tintMask.y = 0;
        // Vector scaling is handled automatically by constraints
      } else {
        tintMask.resize(width, height);
        if (tintMask.type === 'RECTANGLE') {
          (tintMask as RectangleNode).cornerRadius = cornerRadius;
        }
      }
    }
    
    if (tintLayer) {
      tintLayer.resize(width, height);
      if (tintLayer.type === 'VECTOR') {
        tintLayer.x = 0;
        tintLayer.y = 0;
      }
    }
  }

  // Update highlight group elements
  const highlightGroup = node.findOne(n => n.name === 'Highlight group') as FrameNode | null;
  if (highlightGroup) {
    highlightGroup.resize(width, height);
    const highlightMask = highlightGroup.findOne(n => n.name === 'Shape mask');
    const highlightReflection = highlightGroup.findOne(n => n.name.includes('Reflection') || n.name.includes('reflection'));
    
    if (highlightMask) {
      if (highlightMask.type === 'VECTOR') {
        highlightMask.x = 0;
        highlightMask.y = 0;
        // Vector scaling is handled automatically by constraints
      } else {
        highlightMask.resize(width, height);
        if (highlightMask.type === 'RECTANGLE') {
          (highlightMask as RectangleNode).cornerRadius = cornerRadius;
        }
      }
    }
    
    if (highlightReflection) {
      if (highlightReflection.type === 'VECTOR') {
        highlightReflection.x = 0;
        highlightReflection.y = 0;
        // Vector scaling is handled automatically by constraints
      } else {
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

  // Get current parameters and trigger update with image capture
  const refractionParams = parseLayerName(editState.node.name);
  const effectsParams = extractEffectsFromLgElement(editState.node);
  if (refractionParams) {
    // Use 'update' context to trigger capture and send
    updateLgElement(node, { ...refractionParams, ...effectsParams }, 'update');
  }
  
  // Update last bounds
  editState.lastBounds = now;
}