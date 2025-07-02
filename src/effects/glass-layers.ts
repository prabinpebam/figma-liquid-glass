import { EffectsParams } from '../core/types.js';
import { hexToRgb } from '../utils/color-utils.js';
import { formatRefractionLayerName, formatReflectionLayerName, formatTintLayerName, extractEffectsFromLgElement } from '../utils/layer-parser.js';

export const BLEND_MODE_MAP: { [key: string]: BlendMode } = {
  'PASS_THROUGH': 'PASS_THROUGH',
  'NORMAL': 'NORMAL',
  'DARKEN': 'DARKEN',
  'MULTIPLY': 'MULTIPLY',
  'PLUS_DARKER': 'LINEAR_BURN', // Fix: Map to correct Figma enum
  'COLOR_BURN': 'COLOR_BURN',
  'LIGHTEN': 'LIGHTEN',
  'SCREEN': 'SCREEN',
  'PLUS_LIGHTER': 'LINEAR_DODGE', // Fix: Map to correct Figma enum
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

export function applyRefractionEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
  if (!('effects' in layer) || !('strokeWeight' in layer) || !('strokes' in layer)) return;
  
  const layerEffects: Effect[] = [];
  
   
  // Add inner shadow effect
  const innerShadowEffect: Effect = {
    type: 'INNER_SHADOW',
    color: { r: 0, g: 0, b: 0, a: (effects.innerShadowOpacity ?? 40) / 100 },
    offset: { x: effects.innerShadowX ?? 10, y: effects.innerShadowY ?? 10 },
    radius: effects.innerShadowBlur ?? 10,
    spread: effects.innerShadowSpread ?? 0,
    visible: true,
    blendMode: 'NORMAL'
  };
  layerEffects.push(innerShadowEffect);
  
  layer.effects = layerEffects;
  
  // Apply stroke thickness
  layer.strokeWeight = effects.strokeThickness ?? 1;
  layer.strokeAlign = 'OUTSIDE'; // Changed from CENTER to match original
  
  // Apply stroke with gradient
  const strokeColor = hexToRgb(effects.strokeColor ?? '#ffffff');
  const strokeOpacity = (effects.strokeOpacity ?? 100) / 100;
  const angle = (effects.strokeAngle ?? 0) * Math.PI / 180;
  
  // Create rotation matrix for gradient
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const gradientTransform: Transform = [[cos, -sin, 0.5 - 0.5 * cos + 0.5 * sin], [sin, cos, 0.5 - 0.5 * sin - 0.5 * cos]];
  
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

export function applyReflectionEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
  if (!('effects' in layer) || !('strokeWeight' in layer) || !('strokes' in layer)) return;
  
  layer.strokeWeight = effects.highlightStrokeWeight ?? 12;
  layer.strokeAlign = 'CENTER';
  
  const blurEffect: Effect = {
    type: 'LAYER_BLUR',
    blurType: 'NORMAL', // Added missing blurType property
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

export function applyTintEffects(layer: SceneNode, effects: Partial<EffectsParams>): void {
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

// New function to update a single effect parameter
export async function updateSingleEffectParameter(lgElement: FrameNode, parameterName: string, parameterValue: any) {
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