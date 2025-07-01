export interface EditState {
  node: FrameNode | null;
  lastBounds: { x: number; y: number; width: number; height: number; cornerRadius: number | typeof figma.mixed; } | null;
}

export const editState: EditState = {
  node: null,
  lastBounds: null
};
