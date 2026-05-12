export type UnitSystem = 'metric' | 'imperial';

export type EasingType =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier';

export interface CubicBezierParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Keyframe {
  time: number; // seconds
  x: number;   // canvas-space pixels
  y: number;
  easing: EasingType;
  cubicBezier?: CubicBezierParams;
}

export type StripePattern =
  | 'solid'
  | 'halved-h'
  | 'halved-v'
  | 'diagonal-left'
  | 'diagonal-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'hoops'
  | 'quartered'
  | 'cross-sash'
  | 'dots'
  | 'stripes-h'
  | 'stripes-v'
  | 'stripes-diagonal'
  | 'panel-front'
  | 'panel-back'
  | 'sleeves-contrast'
  | 'star'
  | 'diamond'
  | 'seabiscuit'   // classic brown/red
  | 'royal'        // blue/gold
  | 'emerald'      // green/white
  | 'sunset'       // orange/purple
  | 'monochrome';  // black/white

export interface Horse {
  id: string;
  number: number;
  name: string;
  jockey: string;
  stable: string;
  breeder: string;
  baseColor: string;       // hex
  stripeColor: string;     // hex
  pattern: StripePattern;
  keyframes: Keyframe[];
}

export type TrackShapeType = 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'pen';

export interface PenAnchor {
  x: number;
  y: number;
  cpIn: { x: number; y: number };
  cpOut: { x: number; y: number };
}

export interface TrackShape {
  id: string;
  type: TrackShapeType;
  points: number[];
  stroke: string;
  strokeWidth: number;
  strokeAlpha: number;   // 0–1
  fill: string;
  fillAlpha: number;     // 0–1
  closed: boolean;
  order: number;
  name?: string;
  opacity?: number;
  tension?: number;
  visible?: boolean;
  locked?: boolean;
  penAnchors?: PenAnchor[];
}

export interface RefImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0–1
  order: number;
  name?: string;
  rotation?: number;
  visible?: boolean;
  locked: boolean;
}

export interface ProjectFile {
  version: '1';
  name: string;
  units: UnitSystem;
  duration: number;      // seconds
  canvasWidth: number;
  canvasHeight: number;
  trackScale: number;    // pixels per metre
  horses: Horse[];
  trackShapes: TrackShape[];
  refImages: RefImage[];
}
