import { RefractionParams, EffectsParams } from '../core/types.js';

// Use the original layer name format from the reference code
export function formatLayerName(params: RefractionParams): string {
  const et = `ET${params.edge}`;
  const rs = `RS${params.strength}`;
  const ca = `CA${params.ca}`;
  const bb = `BB${params.frost}`;
  return `[LG - ${et} ${rs} ${ca} ${bb}]`;
}

export function formatRefractionLayerName(effects: Partial<EffectsParams>): string {
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

export function formatReflectionLayerName(effects: Partial<EffectsParams>): string {
  const weight = effects.highlightStrokeWeight ?? 12;
  const blur = effects.highlightBlur ?? 14;
  const color = (effects.reflectionColor ?? '#ffffff').replace('#', '');
  const opacity = effects.reflectionOpacity ?? 100;
  
  return `[Reflection: SW${weight} BL${blur} C${color} O${opacity}]`;
}

export function formatTintLayerName(effects: Partial<EffectsParams>): string {
  const color = (effects.tintColor ?? '#ffffff').replace('#', '');
  const opacity = effects.tintOpacity ?? 20;
  const blendMode = effects.tintBlendMode ?? 'NORMAL';
  
  return `[Tint: C${color} O${opacity} BM${blendMode}]`;
}

export function parseLayerName(name: string): RefractionParams | null {
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

export function parseRefractionLayerName(name: string): Partial<EffectsParams> | null {
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

export function parseReflectionLayerName(name: string): Partial<EffectsParams> | null {
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

export function parseTintLayerName(name: string): Partial<EffectsParams> | null {
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

export function extractEffectsFromLgElement(lgElement: FrameNode): Partial<EffectsParams> {
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

export function findLgElementsInSelection(nodes: readonly SceneNode[]): FrameNode[] {
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
