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

export type TrackShapeType = 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'pen' | 'ruler' | 'trackrace';

export type RulerUnit = 'px' | 'm' | 'mi' | 'fur';

export type TrackUnit = 'px' | 'm' | 'mi';
export type TrackSurface = 'turf' | 'dirt';

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
  // ── Track Race fields ────────────────────────────────────────────────────
  trackUnit?: TrackUnit;
  trackSurface?: TrackSurface;
  trackWidths?: number[];       // half-width in pixels at each penAnchor (parallel array)
  trackBorderWidths?: number[]; // border width in pixels at each penAnchor (parallel array)
  trackBorderColor?: string;
  trackBorderOpacity?: number;
  trackHorseInterval?: number;  // horse-length tick interval (0 = off), in trackUnit
  trackTickColor?: string;      // tick line + label color (default #e94560)
  trackTickFontSize?: number;   // label font size in px (default 10)
  trackTickLineWidth?: number;  // tick line stroke width (default 2)
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
