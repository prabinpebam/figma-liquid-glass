// Import necessary modules and functions
import { editState } from '../core/state.js';
import { nodeBounds, boundsEqual } from '../utils/node-bounds.js';
import { parseLayerName, extractEffectsFromLgElement, findLgElementsInSelection } from '../utils/layer-parser.js';
import { analyzeMultipleLgElements } from '../effects/liquid-glass.js';
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
    figma.ui.postMessage({ type: 'selection-changed', isLgElement: true, canApplyEffect: false });
    
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

export function onDocumentChange() {
  if (!editState.node) return;
  
  const now = nodeBounds(editState.node);
  if (boundsEqual(now, editState.lastBounds)) return;

  console.log('LG element properties changed, updating...');
  
  // Update last bounds
  editState.lastBounds = now;
}