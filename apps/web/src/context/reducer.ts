import type { Horse, TrackShape, RefImage, ProjectFile } from '@say-it-so/core'
import type { Action, ActiveTool, ActivePanel, PlaybackState } from './actions'

export interface AppState {
  // project meta
  projectName: string
  units: 'metric' | 'imperial'
  canvasWidth: number
  canvasHeight: number
  trackScale: number   // pixels per metre
  duration: number     // seconds

  // view
  zoom: number
  panX: number
  panY: number
  activeTool: ActiveTool
  activePanel: ActivePanel

  // data
  horses: Horse[]
  trackShapes: TrackShape[]
  refImages: RefImage[]

  // selection
  selectedHorseId: string | null
  selectedShapeId: string | null
  selectedRefImageId: string | null
  editingShapeId: string | null
  selectedAnchorIdx: number | null
  polygonSides: number

  // playback
  currentTime: number
  playbackState: PlaybackState
  playbackSpeed: number
}

export const DEFAULT_STATE: AppState = {
  projectName: 'Untitled Race',
  units: 'metric',
  canvasWidth: 1600,
  canvasHeight: 900,
  trackScale: 10,    // 10px = 1m
  duration: 120,     // 2 min default

  zoom: 1,
  panX: 0,
  panY: 0,
  activeTool: 'select',
  activePanel: 'horses',

  horses: [],
  trackShapes: [],
  refImages: [],

  selectedHorseId: null,
  selectedShapeId: null,
  selectedRefImageId: null,
  editingShapeId: null,
  selectedAnchorIdx: null,
  polygonSides: 6,

  currentTime: 0,
  playbackState: 'idle',
  playbackSpeed: 1,
}

function reorder<T extends { id: string; order: number }>(
  items: T[], id: string, direction: 'up' | 'down',
): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((i) => i.id === id)
  if (idx < 0) return items
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= sorted.length) return items
  const tmp = sorted[idx].order
  sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order }
  sorted[swapIdx] = { ...sorted[swapIdx], order: tmp }
  return sorted
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // ---------- project ----------
    case 'SET_PROJECT_NAME':
      return { ...state, projectName: action.name }
    case 'SET_UNITS':
      return { ...state, units: action.units }
    case 'SET_DURATION':
      return { ...state, duration: action.duration }
    case 'SET_TRACK_SCALE':
      return { ...state, trackScale: action.scale }
    case 'LOAD_PROJECT': {
      const p: ProjectFile = action.payload
      return {
        ...DEFAULT_STATE,
        projectName: p.name,
        units: p.units,
        canvasWidth: p.canvasWidth,
        canvasHeight: p.canvasHeight,
        trackScale: p.trackScale,
        duration: p.duration,
        horses: p.horses,
        trackShapes: p.trackShapes,
        refImages: p.refImages,
      }
    }
    case 'NEW_PROJECT':
      return { ...DEFAULT_STATE }

    // ---------- view ----------
    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.1, Math.min(10, action.zoom)) }
    case 'SET_PAN':
      return { ...state, panX: action.x, panY: action.y }
    case 'SET_ACTIVE_TOOL':
      return { ...state, activeTool: action.tool, editingShapeId: (action.tool === 'pen' || action.tool === 'ruler' || action.tool === 'trackrace') ? state.editingShapeId : null }
    case 'SET_ACTIVE_PANEL':
      return {
        ...state,
        activePanel: action.panel,
        selectedShapeId: null,
        selectedHorseId: null,
        selectedRefImageId: null,
        editingShapeId: null,
        // Stop playback when entering the track editor
        playbackState: action.panel === 'track' ? 'idle' : state.playbackState,
        currentTime: action.panel === 'track' ? 0 : state.currentTime,
      }

    // ---------- horses ----------
    case 'ADD_HORSE':
      return { ...state, horses: [...state.horses, action.horse] }
    case 'UPDATE_HORSE':
      return {
        ...state,
        horses: state.horses.map((h) =>
          h.id === action.id ? { ...h, ...action.patch } : h,
        ),
      }
    case 'REMOVE_HORSE':
      return {
        ...state,
        horses: state.horses.filter((h) => h.id !== action.id),
        selectedHorseId: state.selectedHorseId === action.id ? null : state.selectedHorseId,
      }
    case 'SELECT_HORSE':
      return { ...state, selectedHorseId: action.id }
    case 'UPSERT_KEYFRAME': {
      const SNAP = 0.05 // seconds — treat as same keyframe if within this range
      return {
        ...state,
        horses: state.horses.map((h) => {
          if (h.id !== action.horseId) return h
          const existing = h.keyframes.findIndex((k) => Math.abs(k.time - action.time) < SNAP)
          if (existing >= 0) {
            const kfs = [...h.keyframes]
            kfs[existing] = { ...kfs[existing], x: action.x, y: action.y }
            return { ...h, keyframes: kfs }
          }
          return {
            ...h,
            keyframes: [
              ...h.keyframes,
              { time: action.time, x: action.x, y: action.y, easing: 'linear' },
            ],
          }
        }),
      }
    }
    case 'UPDATE_KEYFRAME_TIME':
      return {
        ...state,
        horses: state.horses.map((h) => {
          if (h.id !== action.horseId) return h
          const kfs = [...h.keyframes]
          kfs[action.index] = { ...kfs[action.index], time: action.newTime }
          return { ...h, keyframes: kfs }
        }),
      }
    case 'UPDATE_KEYFRAME_EASING':
      return {
        ...state,
        horses: state.horses.map((h) => {
          if (h.id !== action.horseId) return h
          const kfs = [...h.keyframes]
          kfs[action.index] = {
            ...kfs[action.index],
            easing: action.easing,
            cubicBezier: action.cubicBezier,
          }
          return { ...h, keyframes: kfs }
        }),
      }
    case 'REMOVE_KEYFRAME':
      return {
        ...state,
        horses: state.horses.map((h) => {
          if (h.id !== action.horseId) return h
          return { ...h, keyframes: h.keyframes.filter((_, i) => i !== action.index) }
        }),
      }
    // ---------- track shapes ----------
    case 'ADD_SHAPE':
      return { ...state, trackShapes: [...state.trackShapes, action.shape] }
    case 'UPDATE_SHAPE':
    case 'UPDATE_SHAPE_LIVE':
      return {
        ...state,
        trackShapes: state.trackShapes.map((s) =>
          s.id === action.id ? { ...s, ...action.patch } : s,
        ),
      }
    case 'REMOVE_SHAPE':
      return {
        ...state,
        trackShapes: state.trackShapes.filter((s) => s.id !== action.id),
        selectedShapeId: state.selectedShapeId === action.id ? null : state.selectedShapeId,
        editingShapeId: state.editingShapeId === action.id ? null : state.editingShapeId,
      }
    case 'SET_EDITING_SHAPE':
      return { ...state, editingShapeId: action.id, selectedAnchorIdx: null }
    case 'SELECT_ANCHOR':
      return { ...state, selectedAnchorIdx: action.idx }
    case 'SET_POLYGON_SIDES':
      return { ...state, polygonSides: Math.max(3, Math.min(32, action.sides)) }
    case 'SELECT_SHAPE':
      return { ...state, selectedShapeId: action.id }
    case 'REORDER_SHAPE':
      return { ...state, trackShapes: reorder(state.trackShapes, action.id, action.direction) }

    // ---------- ref images ----------
    case 'ADD_REF_IMAGE':
      return { ...state, refImages: [...state.refImages, action.image] }
    case 'UPDATE_REF_IMAGE':
    case 'UPDATE_REF_IMAGE_LIVE':
      return {
        ...state,
        refImages: state.refImages.map((img) =>
          img.id === action.id ? { ...img, ...action.patch } : img,
        ),
      }
    case 'REMOVE_REF_IMAGE':
      return {
        ...state,
        refImages: state.refImages.filter((img) => img.id !== action.id),
        selectedRefImageId: state.selectedRefImageId === action.id ? null : state.selectedRefImageId,
      }
    case 'SELECT_REF_IMAGE':
      return { ...state, selectedRefImageId: action.id, selectedShapeId: null }
    case 'REORDER_REF_IMAGE':
      return { ...state, refImages: reorder(state.refImages, action.id, action.direction) }

    // ---------- playback ----------
    case 'SET_CURRENT_TIME':
      return { ...state, currentTime: Math.max(0, Math.min(state.duration, action.time)) }
    case 'SET_PLAYBACK_STATE':
      return { ...state, playbackState: action.state }
    case 'SET_PLAYBACK_SPEED':
      return { ...state, playbackSpeed: action.speed }

    // ---------- history ----------
    case 'SNAPSHOT':
      return state
    case 'RESTORE_STATE':
      return {
        ...action.payload,
        // preserve current view/interaction state
        activeTool: state.activeTool,
        activePanel: state.activePanel,
        zoom: state.zoom,
        panX: state.panX,
        panY: state.panY,
        selectedShapeId: state.selectedShapeId,
        selectedHorseId: state.selectedHorseId,
        selectedRefImageId: state.selectedRefImageId,
        editingShapeId: null,
        selectedAnchorIdx: null,
        playbackState: state.playbackState,
        currentTime: state.currentTime,
        playbackSpeed: state.playbackSpeed,
      }

    default:
      return state
  }
}
