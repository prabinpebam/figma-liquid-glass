import { editState } from '../core/state.js';
import { nodeBounds } from '../utils/node-bounds.js';
import { OFFSET } from '../core/constants.js';

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

export async function captureAndSendComplex(target: FrameNode, params: any, svgData?: string, nodeId: string = target.id) {
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

export async function captureAndSend(target: FrameNode, params: any, nodeId: string = target.id) {
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

function getShapeType(node: SceneNode): 'rectangle' | 'ellipse' | 'complex' {
  if (node.type === 'RECTANGLE' && ('rotation' in node ? node.rotation === 0 : true)) return 'rectangle';
  if (node.type === 'ELLIPSE' && ('rotation' in node ? node.rotation === 0 : true)) return 'ellipse';
  return 'complex';
}
