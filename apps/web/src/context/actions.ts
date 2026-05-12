import type {
  Horse, TrackShape, RefImage, UnitSystem,
  StripePattern, EasingType, CubicBezierParams, ProjectFile,
} from '@say-it-so/core'

export type ActiveTool =
  | 'select' | 'pen' | 'rect' | 'ellipse' | 'polygon'
  | 'measure' | 'image'

export type ActivePanel = 'horses' | 'track'

export type PlaybackState = 'idle' | 'playing' | 'paused'

// ---------- action types ----------

export type Action =
  // project
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'SET_UNITS'; units: UnitSystem }
  | { type: 'SET_DURATION'; duration: number }
  | { type: 'SET_TRACK_SCALE'; scale: number }
  | { type: 'LOAD_PROJECT'; payload: ProjectFile }
  | { type: 'NEW_PROJECT' }

  // canvas / view
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_PAN'; x: number; y: number }
  | { type: 'SET_ACTIVE_TOOL'; tool: ActiveTool }
  | { type: 'SET_ACTIVE_PANEL'; panel: ActivePanel }

  // horses
  | { type: 'ADD_HORSE'; horse: Horse }
  | { type: 'UPDATE_HORSE'; id: string; patch: Partial<Omit<Horse, 'id' | 'keyframes'>> }
  | { type: 'REMOVE_HORSE'; id: string }
  | { type: 'SELECT_HORSE'; id: string | null }
  | { type: 'UPSERT_KEYFRAME'; horseId: string; time: number; x: number; y: number }
  | { type: 'UPDATE_KEYFRAME_TIME'; horseId: string; index: number; newTime: number }
  | { type: 'UPDATE_KEYFRAME_EASING'; horseId: string; index: number; easing: EasingType; cubicBezier?: CubicBezierParams }
  | { type: 'REMOVE_KEYFRAME'; horseId: string; index: number }

  // track shapes
  | { type: 'ADD_SHAPE'; shape: TrackShape }
  | { type: 'UPDATE_SHAPE'; id: string; patch: Partial<TrackShape> }
  | { type: 'UPDATE_SHAPE_LIVE'; id: string; patch: Partial<TrackShape> }
  | { type: 'REMOVE_SHAPE'; id: string }
  | { type: 'SELECT_SHAPE'; id: string | null }
  | { type: 'REORDER_SHAPE'; id: string; direction: 'up' | 'down' }

  // ref images
  | { type: 'ADD_REF_IMAGE'; image: RefImage }
  | { type: 'UPDATE_REF_IMAGE'; id: string; patch: Partial<RefImage> }
  | { type: 'UPDATE_REF_IMAGE_LIVE'; id: string; patch: Partial<RefImage> }
  | { type: 'REMOVE_REF_IMAGE'; id: string }
  | { type: 'REORDER_REF_IMAGE'; id: string; direction: 'up' | 'down' }
  | { type: 'SELECT_REF_IMAGE'; id: string | null }

  // timeline / playback
  | { type: 'SET_CURRENT_TIME'; time: number }
  | { type: 'SET_PLAYBACK_STATE'; state: PlaybackState }

  // horse pattern helper
  | { type: 'SET_HORSE_PATTERN'; id: string; pattern: StripePattern; baseColor: string; stripeColor: string }

  // shape editing
  | { type: 'SET_EDITING_SHAPE'; id: string | null }
  | { type: 'SET_POLYGON_SIDES'; sides: number }

  // history
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SNAPSHOT' }
  | { type: 'RESTORE_STATE'; payload: import('./reducer').AppState }
