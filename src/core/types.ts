export interface RefractionParams {
  edge: number;
  strength: number;
  ca: number;
  frost: number;
}

export interface EffectsParams {
  innerShadowX: number;
  innerShadowY: number;
  innerShadowBlur: number;
  innerShadowSpread: number;
  innerShadowOpacity: number;
  strokeAngle: number;
  strokeColor: string;
  strokeThickness: number;
  strokeOpacity: number;
  highlightStrokeWeight: number;
  highlightBlur: number;
  reflectionColor: string;
  reflectionOpacity: number;
  tintColor: string;
  tintOpacity: number;
  tintBlendMode: string;
}

export interface AllParams extends RefractionParams, EffectsParams {}
