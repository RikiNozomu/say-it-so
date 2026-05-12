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

export interface Horse {
  id: string;
  number: number;
  name: string;
  color: string;       // hex — circle background
  textColor: string;   // hex — number text
  keyframes: Keyframe[];
}

export type TrackShapeType = 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'pen' | 'ruler';

export type RulerUnit = 'px' | 'm' | 'mi' | 'fur';

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
  rulerUnit?: RulerUnit;
  rulerLabelColor?: string;
  rulerLabelColorOpacity?: number;
  rulerLabelBg?: string;
  rulerLabelBgOpacity?: number;
  rulerSeqInterval?: number;   // interval in the ruler's unit (0 = disabled)
  rulerSeqColor?: string;
  rulerSeqColorOpacity?: number;
  rulerFontSize?: number;
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
