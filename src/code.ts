// Show the UI using the HTML content from manifest.json
figma.showUI(__html__, { width: 300, height: 600 });

// Import all modules using relative paths (path mappings not working with current esbuild setup)
import { editState } from './core/state.js';
import { onSelectionChange, onDocumentChange } from './ui-communication/message-handler.js';
import { createLgElement, updateLgElement, analyzeMultipleLgElements } from './effects/liquid-glass.js';
import { createOrUpdateLgFromSelection } from './effects/refraction.js';
import { updateSingleEffectParameter, BLEND_MODE_MAP } from './effects/glass-layers.js';
import { findLgElementsInSelection, parseLayerName, extractEffectsFromLgElement } from './utils/layer-parser.js';
import { captureAndSend } from './effects/capture.js';

// Add missing variables
let isUpdatingAll = false;
let scriptIsMakingChange = false;

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
    } else if (msg.type === 'update-lg-element-effects-only') {
      console.log('Updating LG element effects only');
      if (editState.node) {
        await updateLgElement(editState.node, msg.params, 'effects-only');
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
          
          // Use the parameters from the UI - this updates all parameters to make them uniform
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
      scriptIsMakingChange = false;

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
    } else if (msg.type === 'preview-blend-mode') {
      console.log('Previewing blend mode:', msg.blendMode);
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) return;
      
      // Find all LG elements in selection (including nested)
      const lgElements = findLgElementsInSelection(selection);
      
      if (lgElements.length === 0) {
        console.log('No LG elements found in selection for blend mode preview');
        return;
      }
      
      // Apply blend mode preview to all LG elements
      for (const lgElement of lgElements) {
        const tintGroup = lgElement.findOne(n => n.name === 'tint group') as FrameNode;
        if (tintGroup) {
          const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
          if (tintLayer && 'blendMode' in tintLayer) {
            const blendMode = BLEND_MODE_MAP[msg.blendMode] || 'NORMAL';
            tintLayer.blendMode = blendMode;
          }
        }
      }
      
      console.log(`Previewed blend mode ${msg.blendMode} for ${lgElements.length} LG elements`);
    } else if (msg.type === 'revert-blend-mode') {
      console.log('Reverting blend mode to:', msg.originalBlendMode);
      const selection = figma.currentPage.selection;
      
      if (selection.length === 0) return;
      
      // Find all LG elements in selection (including nested)
      const lgElements = findLgElementsInSelection(selection);
      
      if (lgElements.length === 0) {
        console.log('No LG elements found in selection for blend mode revert');
        return;
      }
      
      // Revert blend mode for all LG elements
      for (const lgElement of lgElements) {
        const tintGroup = lgElement.findOne(n => n.name === 'tint group') as FrameNode;
        if (tintGroup) {
          const tintLayer = tintGroup.findOne(n => n.name.includes('Tint'));
          if (tintLayer && 'blendMode' in tintLayer) {
            const blendMode = BLEND_MODE_MAP[msg.originalBlendMode] || 'NORMAL';
            tintLayer.blendMode = blendMode;
          }
        }
      }
      
      console.log(`Reverted blend mode to ${msg.originalBlendMode} for ${lgElements.length} LG elements`);
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
