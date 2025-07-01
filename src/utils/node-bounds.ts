// node-bounds.ts - Utility functions for node bounds and shape type detection

// Get the bounds of a node
export function nodeBounds(node: SceneNode): { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } {
  const t = node.absoluteTransform;
  const cornerRadius = 'cornerRadius' in node ? (node as FrameNode | RectangleNode).cornerRadius : 0;
  return { x: t[0][2], y: t[1][2], width: (node as any).width, height: (node as any).height, cornerRadius };
}

// Check if two bounds are equal
export function boundsEqual(a: { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } | null, b: { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } | null): boolean {
  return a && b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.cornerRadius === b.cornerRadius;
}

// Get shape type of a node
export function getShapeType(node: SceneNode): 'rectangle' | 'ellipse' | 'complex' {
  if (node.type === 'RECTANGLE' && ('rotation' in node ? node.rotation === 0 : true)) return 'rectangle';
  if (node.type === 'ELLIPSE' && ('rotation' in node ? node.rotation === 0 : true)) return 'ellipse';
  return 'complex';
}