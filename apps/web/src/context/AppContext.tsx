/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { reducer, DEFAULT_STATE, type AppState } from './reducer'
import type { Action } from './actions'

const UNDOABLE = new Set([
  'ADD_SHAPE', 'UPDATE_SHAPE', 'REMOVE_SHAPE', 'REORDER_SHAPE',
  'ADD_HORSE', 'UPDATE_HORSE', 'REMOVE_HORSE',
  'UPSERT_KEYFRAME', 'UPDATE_KEYFRAME_CP', 'UPDATE_KEYFRAME_XY', 'REMOVE_KEYFRAME', 'SET_HORSE_PATTERN',
  'ADD_REF_IMAGE', 'UPDATE_REF_IMAGE', 'REMOVE_REF_IMAGE', 'REORDER_REF_IMAGE',
  'SET_PROJECT_NAME', 'SET_DURATION', 'SET_TRACK_SCALE',
  'SNAPSHOT',
])

const MAX_HISTORY = 50

interface AppContextValue {
  state: AppState
  dispatch: React.Dispatch<Action>
  canUndo: boolean
  canRedo: boolean
  penDrawing: boolean
  setPenDrawing: (v: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

const LS_KEY = 'say-it-so-autosave'

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatchBase] = useReducer(reducer, DEFAULT_STATE, (init) => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) return { ...init, ...JSON.parse(saved) }
    } catch { /* ignore */ }
    return init
  })

  const stateRef = useRef(state)
  stateRef.current = state

  const past = useRef<AppState[]>([])
  const future = useRef<AppState[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [penDrawing, setPenDrawing] = useState(false)
  const penDrawingRef = useRef(false)
  penDrawingRef.current = penDrawing

  const syncFlags = useCallback(() => {
    setCanUndo(past.current.length > 0)
    setCanRedo(future.current.length > 0)
  }, [])

  const dispatch = useCallback((action: Action) => {
    if (action.type === 'UNDO') {
      if (past.current.length === 0 || penDrawingRef.current) return
      future.current.unshift(stateRef.current)
      if (future.current.length > MAX_HISTORY) future.current.pop()
      dispatchBase({ type: 'RESTORE_STATE', payload: past.current.pop()! })
      syncFlags()
      return
    }
    if (action.type === 'REDO') {
      if (future.current.length === 0 || penDrawingRef.current) return
      past.current.push(stateRef.current)
      if (past.current.length > MAX_HISTORY) past.current.shift()
      dispatchBase({ type: 'RESTORE_STATE', payload: future.current.shift()! })
      syncFlags()
      return
    }
    if (UNDOABLE.has(action.type)) {
      past.current.push(stateRef.current)
      if (past.current.length > MAX_HISTORY) past.current.shift()
      future.current = []
      syncFlags()
    }
    dispatchBase(action as Action)
  }, [syncFlags])

  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch { /* ignore */ }
    }, 1000)
    return () => clearTimeout(id)
  }, [state])

  return (
    <AppContext.Provider value={{ state, dispatch, canUndo, canRedo, penDrawing, setPenDrawing }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
