import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Line, Rect, Ellipse, Path, Circle } from 'react-konva'
import type Konva from 'konva'
import { FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi'
import { useApp } from '../../context/AppContext'
import { anchorsToPath, shapeToPenAnchors } from '../../utils/pen'
import type { PenAnchor } from '../../utils/pen'
import { UnifiedLayer } from './UnifiedLayer'
import { HorseLayer } from './HorseLayer'
import { MotionPathLayer } from './MotionPathLayer'
import { MeasurementLayer } from './MeasurementLayer'
import { EditOverlay } from './EditOverlay'

const ZOOM_FACTOR = 1.15
const MIN_ZOOM = 0.1
const MAX_ZOOM = 10

// Drag tools: commit on mouseup after drag
const DRAG_TOOLS = new Set(['rect', 'ellipse', 'polygon'])

interface DrawingState {
  startX: number
  startY: number
  points: number[]   // committed points only
}

interface PenDrawState {
  anchors: PenAnchor[]
  continuationShapeId?: string
  continuationEnd?: 'start' | 'end'
}

export function TrackCanvas() {
  const { state, dispatch, setPenDrawing } = useApp()
  const stageRef = useRef<Konva.Stage | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shiftHeld = useRef(false)
  const spaceHeld = useRef(false)
  const penDragRef = useRef(false) // true while mouse is held during pen anchor placement
  const midPanRef = useRef<{ clientX: number; clientY: number; stageX: number; stageY: number } | null>(null)
  const [spacePanning, setSpacePanning] = useState(false)
  const [midPanning, setMidPanning] = useState(false)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [drawing, setDrawing] = useState<DrawingState | null>(null)
  const [penDraw, setPenDraw] = useState<PenDrawState | null>(null)
  // Live mouse position (canvas-space) for drawing preview
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => { setPenDrawing(penDraw !== null) }, [penDraw, setPenDrawing])

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Prevent browser from intercepting Ctrl/Cmd+wheel (page zoom) and middle-mouse auto-scroll
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const preventWheel = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault() }
    const preventMiddle = (e: MouseEvent) => { if (e.button === 1) e.preventDefault() }
    el.addEventListener('wheel', preventWheel, { passive: false })
    el.addEventListener('mousedown', preventMiddle)
    return () => {
      el.removeEventListener('wheel', preventWheel)
      el.removeEventListener('mousedown', preventMiddle)
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (state.activePanel === 'race') {
          // Horse mode: space = toggle play/pause
          dispatch({
            type: 'SET_PLAYBACK_STATE',
            state: state.playbackState === 'playing' ? 'paused' : 'playing',
          })
        } else {
          if (!spaceHeld.current) {
            spaceHeld.current = true
            setSpacePanning(true)
          }
        }
        return
      }
      if (e.code === 'ArrowLeft')
        dispatch({ type: 'SET_CURRENT_TIME', time: Math.max(0, state.currentTime - 1) })
      if (e.code === 'ArrowRight')
        dispatch({ type: 'SET_CURRENT_TIME', time: Math.min(state.duration, state.currentTime + 1) })
      if (e.code === 'Escape') {
        setDrawing(null)
        setPenDraw(null)
        setPreview(null)
        dispatch({ type: 'SET_EDITING_SHAPE', id: null })
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (state.editingShapeId) return  // EditOverlay handles anchor deletion
        if (state.selectedShapeId) dispatch({ type: 'REMOVE_SHAPE', id: state.selectedShapeId })
        else if (state.selectedRefImageId) dispatch({ type: 'REMOVE_REF_IMAGE', id: state.selectedRefImageId })
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) dispatch({ type: 'REDO' })
        else dispatch({ type: 'UNDO' })
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault()
        dispatch({ type: 'REDO' })
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeld.current = false
      if (e.code === 'Space') {
        spaceHeld.current = false
        setSpacePanning(false)
      }
    }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', onKeyUp) }
  }, [state.currentTime, state.duration, state.selectedShapeId, state.selectedRefImageId, state.editingShapeId, state.activePanel, state.playbackState, dispatch])

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (!stage) return

      if (e.evt.ctrlKey || e.evt.metaKey) {
        // Ctrl/Cmd + wheel → pan
        const newX = stage.x() - e.evt.deltaX
        const newY = stage.y() - e.evt.deltaY
        stage.position({ x: newX, y: newY })
        dispatch({ type: 'SET_PAN', x: newX, y: newY })
        return
      }

      // Plain wheel → zoom around pointer
      const oldScale = stage.scaleX()
      const pointer = stage.getPointerPosition()!
      const origin = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      }
      const dir = e.evt.deltaY < 0 ? 1 : -1
      const newScale = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, oldScale * (dir > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR)),
      )
      stage.scale({ x: newScale, y: newScale })
      stage.position({
        x: pointer.x - origin.x * newScale,
        y: pointer.y - origin.y * newScale,
      })
      dispatch({ type: 'SET_ZOOM', zoom: newScale })
      dispatch({ type: 'SET_PAN', x: stage.x(), y: stage.y() })
    },
    [dispatch],
  )

  // Clear pen state when switching away from pen/ruler/trackrace tool
  useEffect(() => {
    if (state.activeTool !== 'pen' && state.activeTool !== 'ruler' && state.activeTool !== 'trackrace') setPenDraw(null)
  }, [state.activeTool])

  function snapAngle(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number } {
    const dx = toX - fromX, dy = toY - fromY
    const dist = Math.hypot(dx, dy)
    if (dist === 0) return { x: toX, y: toY }
    const step = (15 * Math.PI) / 180
    const snapped = Math.round(Math.atan2(dy, dx) / step) * step
    return { x: fromX + dist * Math.cos(snapped), y: fromY + dist * Math.sin(snapped) }
  }

  function regularPolygonPoints(cx: number, cy: number, radius: number, sides: number, angleOffset = 0): number[] {
    const pts: number[] = []
    for (let i = 0; i < sides; i++) {
      const angle = (Math.PI * 2 * i) / sides - Math.PI / 2 + angleOffset
      pts.push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle))
    }
    return pts
  }

  function canvasCoords(): { x: number; y: number } {
    const stage = stageRef.current!
    const pos = stage.getPointerPosition()!
    const scale = stage.scaleX()
    return {
      x: (pos.x - stage.x()) / scale,
      y: (pos.y - stage.y()) / scale,
    }
  }

  function commitPenPath(anchors: PenAnchor[], closed: boolean) {
    if (anchors.length < 2) { setPenDraw(null); return }
    const isRuler = state.activeTool === 'ruler'
    const isTrackRace = state.activeTool === 'trackrace'
    const effectiveClosed = (isRuler || isTrackRace) ? false : closed
    if (penDraw?.continuationShapeId) {
      const existing = state.trackShapes.find(s => s.id === penDraw.continuationShapeId)
      if (existing?.penAnchors) {
        // anchors[0] is the startAnchor (= existing endpoint), so exclude it to avoid duplicates
        const merged = penDraw.continuationEnd === 'start'
          ? [...anchors.slice().reverse().slice(0, -1), ...existing.penAnchors]
          : [...existing.penAnchors, ...anchors.slice(1)]
        // Extend parallel width arrays when continuing a trackrace
        let patch: Partial<typeof existing> = { penAnchors: merged, closed: effectiveClosed }
        if (existing.type === 'trackrace') {
          const defaultW = (existing.trackWidths?.[0]) ?? 20 * state.trackScale
          const newWidths = anchors.slice(1).map(() => defaultW)
          const mergedWidths = penDraw.continuationEnd === 'start'
            ? [...[...newWidths].reverse(), ...( existing.trackWidths ?? existing.penAnchors.map(() => defaultW))]
            : [...(existing.trackWidths ?? existing.penAnchors.map(() => defaultW)), ...newWidths]
          const defaultBW = (existing.trackBorderWidths?.[0]) ?? 3 * state.trackScale
          const newBorderWidths = anchors.slice(1).map(() => defaultBW)
          const mergedBorderWidths = penDraw.continuationEnd === 'start'
            ? [...[...newBorderWidths].reverse(), ...(existing.trackBorderWidths ?? existing.penAnchors.map(() => defaultBW))]
            : [...(existing.trackBorderWidths ?? existing.penAnchors.map(() => defaultBW)), ...newBorderWidths]
          patch = { ...patch, trackWidths: mergedWidths, trackBorderWidths: mergedBorderWidths }
        }
        dispatch({ type: 'SNAPSHOT' })
        dispatch({ type: 'UPDATE_SHAPE', id: penDraw.continuationShapeId, patch })
        dispatch({ type: 'SET_EDITING_SHAPE', id: penDraw.continuationShapeId })
        setPenDraw(null); setPreview(null)
        return
      }
    }
    const defaultTrackWidthPx = 20 * state.trackScale  // 20 metres default
    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: crypto.randomUUID(),
        type: isRuler ? 'ruler' : isTrackRace ? 'trackrace' : 'pen',
        name: autoName(isRuler ? 'ruler' : isTrackRace ? 'trackrace' : 'pen'),
        points: [],
        penAnchors: anchors,
        stroke: isTrackRace ? '#ffffff' : '#00e5ff',
        strokeWidth: 2,
        strokeAlpha: 1,
        fill: 'transparent',
        fillAlpha: 0,
        closed: effectiveClosed,
        visible: true,
        locked: false,
        order: state.trackShapes.length,
        ...(isRuler && {
          rulerUnit: 'm',
          rulerLabelColor: '#ffffff',
          rulerLabelColorOpacity: 1,
          rulerLabelBg: '#000000',
          rulerLabelBgOpacity: 0.75,
          rulerSeqInterval: 0,
          rulerSeqColor: '#ffdd00',
          rulerSeqColorOpacity: 1,
        }),
        ...(isTrackRace && {
          trackUnit: 'm' as const,
          trackSurface: 'turf' as const,
          trackWidths: anchors.map(() => defaultTrackWidthPx),
          trackBorderWidths: anchors.map(() => 3 * state.trackScale),
          trackBorderColor: '#ffffff',
          trackBorderOpacity: 1,
          trackHorseInterval: 0,
        }),
      },
    })
    setPenDraw(null)
    setPreview(null)
  }

  function handleContinuePen(shapeId: string, anchors: PenAnchor[], fromEnd: 'start' | 'end') {
    const startAnchor = fromEnd === 'end' ? anchors[anchors.length - 1] : anchors[0]
    const existing = state.trackShapes.find(s => s.id === shapeId)
    const tool = existing?.type === 'ruler' ? 'ruler' : existing?.type === 'trackrace' ? 'trackrace' : 'pen'
    dispatch({ type: 'SET_EDITING_SHAPE', id: null })
    dispatch({ type: 'SET_ACTIVE_TOOL', tool })
    setPenDraw({
      anchors: [startAnchor],
      continuationShapeId: shapeId,
      continuationEnd: fromEnd,
    })
  }

  function autoName(type: string) {
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    const count = state.trackShapes.filter((s) => s.type === type).length
    return `${label} ${count + 1}`
  }

  function commitShape(points: number[], closed = false, tension?: number) {
    const tool = state.activeTool as string
    dispatch({
      type: 'ADD_SHAPE',
      shape: {
        id: crypto.randomUUID(),
        type: tool as 'bezier' | 'rect' | 'ellipse' | 'polygon',
        name: autoName(tool),
        points,
        stroke: '#ffffff',
        strokeWidth: 2,
        strokeAlpha: 1,
        fill: '#ffffff',
        fillAlpha: 0,
        closed,
        visible: true,
        locked: false,
        order: state.trackShapes.length,
        ...(tension !== undefined && { tension }),
      },
    })
    setDrawing(null)
    setPreview(null)
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    // Middle mouse button → start panning
    if (e.evt.button === 1) {
      e.evt.preventDefault()
      const stage = stageRef.current
      if (stage) {
        midPanRef.current = { clientX: e.evt.clientX, clientY: e.evt.clientY, stageX: stage.x(), stageY: stage.y() }
        setMidPanning(true)
      }
      return
    }
    if (e.evt.button !== 0) return  // ignore right mouse button
    if (spaceHeld.current) return   // space panning — Stage draggable handles it
    if (state.activePanel === 'race' || state.activePanel === 'preview') {
      // Deselect horse on empty-space click (when MotionPathLayer not rendered)
      if (e.target === e.target.getStage() && state.selectedHorseId) {
        let moved = false
        const onMove = () => { moved = true }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          if (!moved) dispatch({ type: 'SELECT_HORSE', id: null })
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }
      return
    }
    if (state.activePanel !== 'track') return
    // While editing a shape all canvas interaction is locked to the EditOverlay
    if (state.editingShapeId) return
    const tool = state.activeTool
    if (tool === 'select' || tool === 'measure') {
      if (e.target === e.target.getStage()) {
        dispatch({ type: 'SELECT_SHAPE', id: null })
        dispatch({ type: 'SELECT_HORSE', id: null })
        dispatch({ type: 'SELECT_REF_IMAGE', id: null })
        dispatch({ type: 'SET_EDITING_SHAPE', id: null })
      }
      return
    }

    // Don't start a new shape when clicking on an existing shape/image,
    // but allow placing pen/ruler anchors on top of existing objects while mid-draw
    if (e.target !== e.target.getStage() && !penDraw) return

    const { x, y } = canvasCoords()

    if (tool === 'pen' || tool === 'ruler' || tool === 'trackrace') {
      let px = x, py = y
      if (e.evt.shiftKey && penDraw && penDraw.anchors.length > 0) {
        const last = penDraw.anchors[penDraw.anchors.length - 1]
        ;({ x: px, y: py } = snapAngle(last.x, last.y, x, y))
      }
      const newAnchor: PenAnchor = { x: px, y: py, cpIn: { x: px, y: py }, cpOut: { x: px, y: py } }
      penDragRef.current = true
      if (!penDraw) {
        setPenDraw({ anchors: [newAnchor] })
      } else {
        // Close path — pen only, not ruler/trackrace
        if (tool === 'pen') {
          const first = penDraw.anchors[0]
          const dist = Math.hypot(px - first.x, py - first.y)
          if (dist < 16 / state.zoom && penDraw.anchors.length >= 2) {
            penDragRef.current = false
            commitPenPath(penDraw.anchors, true)
            return
          }
        }
        setPenDraw((d) => d ? { ...d, anchors: [...d.anchors, newAnchor] } : null)
      }
    } else if (DRAG_TOOLS.has(tool)) {
      // Start drag — will update on mousemove, commit on mouseup
      setDrawing({ startX: x, startY: y, points: [x, y] })
    }
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    shiftHeld.current = e.evt.shiftKey
    // Middle mouse pan
    if (midPanRef.current) {
      const stage = stageRef.current
      if (stage) {
        const dx = e.evt.clientX - midPanRef.current.clientX
        const dy = e.evt.clientY - midPanRef.current.clientY
        const newX = midPanRef.current.stageX + dx
        const newY = midPanRef.current.stageY + dy
        stage.position({ x: newX, y: newY })
        dispatch({ type: 'SET_PAN', x: newX, y: newY })
      }
    }
    const { x, y } = canvasCoords()
    setPreview({ x, y })

    // Drag-to-curve: while mouse held after placing a pen/ruler anchor, pull out handles
    if ((state.activeTool === 'pen' || state.activeTool === 'ruler' || state.activeTool === 'trackrace') && penDragRef.current) {
      setPenDraw((d) => {
        if (!d || d.anchors.length === 0) return d
        const ancs = [...d.anchors]
        const last = ancs[ancs.length - 1]
        if (e.evt.altKey) {
          // Alt = one-sided: only move cpOut (break incoming symmetry)
          ancs[ancs.length - 1] = { ...last, cpOut: { x, y } }
        } else {
          ancs[ancs.length - 1] = {
            ...last,
            cpOut: { x, y },
            cpIn:  { x: 2 * last.x - x, y: 2 * last.y - y },
          }
        }
        return { ...d, anchors: ancs }
      })
    }

    if (!drawing) return
    const tool = state.activeTool

    // For drag tools only: update the shape live during drag
    if (tool === 'rect') {
      const dx = x - drawing.startX, dy = y - drawing.startY
      if (shiftHeld.current) {
        const size = Math.min(Math.abs(dx), Math.abs(dy))
        setDrawing((d) => d ? { ...d, points: [d.startX, d.startY, Math.sign(dx) * size, Math.sign(dy) * size] } : null)
      } else {
        setDrawing((d) => d ? { ...d, points: [d.startX, d.startY, dx, dy] } : null)
      }
    } else if (tool === 'ellipse') {
      const dx = x - drawing.startX, dy = y - drawing.startY
      if (shiftHeld.current) {
        const r = Math.min(Math.abs(dx), Math.abs(dy)) / 2
        setDrawing((d) => d ? { ...d, points: [d.startX + Math.sign(dx) * r, d.startY + Math.sign(dy) * r, r, r] } : null)
      } else {
        setDrawing((d) => d ? { ...d, points: [(d.startX + x) / 2, (d.startY + y) / 2, Math.abs(dx) / 2, Math.abs(dy) / 2] } : null)
      }
    } else if (tool === 'polygon') {
      setDrawing((d) => {
        if (!d) return null
        const radius = Math.hypot(x - d.startX, y - d.startY)
        const angleOffset = Math.atan2(y - d.startY, x - d.startX) + Math.PI / 2
        const pts = regularPolygonPoints(d.startX, d.startY, radius, state.polygonSides, angleOffset - Math.PI / 2)
        return { ...d, points: pts }
      })
    }
  }

  function handleMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button === 1) {
      midPanRef.current = null
      setMidPanning(false)
      return
    }
    const wasPenDragging = penDragRef.current
    penDragRef.current = false

    // After a pen/ruler drag, retract cpOut so the next segment isn't forced into a curve.
    // cpIn stays (keeps the incoming curve smooth); cpOut returns to anchor position (outgoing is free).
    if (wasPenDragging && (state.activeTool === 'pen' || state.activeTool === 'ruler' || state.activeTool === 'trackrace')) {
      setPenDraw((d) => {
        if (!d || d.anchors.length === 0) return d
        const ancs = [...d.anchors]
        const last = ancs[ancs.length - 1]
        if (last.cpOut.x !== last.x || last.cpOut.y !== last.y) {
          ancs[ancs.length - 1] = { ...last, cpOut: { x: last.x, y: last.y } }
        }
        return { ...d, anchors: ancs }
      })
    }

    if (!drawing) return
    const tool = state.activeTool

    if (!DRAG_TOOLS.has(tool)) return // click tools commit on dblclick

    if (tool === 'rect') {
      const [sx, sy, w, h] = drawing.points
      if (Math.abs(w) < 3 || Math.abs(h) < 3) { setDrawing(null); return }
      commitShape([sx, sy, w, h])
    } else if (tool === 'ellipse') {
      const [cx, cy, rx, ry] = drawing.points
      if (rx < 2 || ry < 2) { setDrawing(null); return }
      commitShape([cx, cy, rx, ry])
    } else if (tool === 'polygon') {
      if (drawing.points.length < 6) { setDrawing(null); return }
      commitShape(drawing.points, true)
    }
  }

  function handleDblClick() {
    const tool = state.activeTool

    if ((tool === 'pen' || tool === 'ruler' || tool === 'trackrace') && penDraw && penDraw.anchors.length >= 2) {
      const anchors = penDraw.anchors.slice(0, -1)
      commitPenPath(anchors, false)
      return
    }

  }

  // ── Drawing preview render ──────────────────────────────────────────────
  function renderPreview() {
    const tool = state.activeTool
    const dash = [6, 4]
    const previewColor = '#00e5ff'

    // ── Pen / Ruler tool preview ──────────────────────────────────────────
    if ((tool === 'pen' || tool === 'ruler' || tool === 'trackrace') && penDraw) {
      const { anchors } = penDraw
      const z = state.zoom
      const hs = 5 / z   // anchor square half-size (screen-space 5px)
      const cs = 3 / z   // control-point circle radius
      const elems: React.ReactNode[] = []

      // Committed path so far
      if (anchors.length >= 2) {
        elems.push(
          <Path key="pen-path" data={anchorsToPath(anchors, false)}
            stroke={previewColor} strokeWidth={1.5 / z} dash={dash.map(d => d / z)} listening={false} />
        )
      }



      // Anchor markers
      anchors.forEach((a, i) => {
        const isFirst = i === 0
        const nearFirst = isFirst && preview && anchors.length >= 2 &&
          Math.hypot(preview.x - a.x, preview.y - a.y) < 16 / z
        // Green snap ring only for pen (rulers can't close)
        if (nearFirst && tool === 'pen') {
          elems.push(
            <Circle key="close-ring" x={a.x} y={a.y} radius={hs * 2.5}
              stroke="#00ff88" strokeWidth={1.5 / z} fill="rgba(0,255,136,0.15)" listening={false} />
          )
        }
        elems.push(
          <Rect key={`anc-${i}`} x={a.x - hs} y={a.y - hs} width={hs * 2} height={hs * 2}
            fill={nearFirst ? '#00ff88' : '#1a1a2e'} stroke={previewColor} strokeWidth={1 / z} listening={false} />
        )

        // Show handles independently — cpOut and cpIn can each be non-degenerate on their own
        if (a.cpOut.x !== a.x || a.cpOut.y !== a.y) {
          elems.push(
            <Line key={`cout-l-${i}`} points={[a.x, a.y, a.cpOut.x, a.cpOut.y]}
              stroke="#aaaaff" strokeWidth={1 / z} listening={false} />,
            <Circle key={`cout-c-${i}`} x={a.cpOut.x} y={a.cpOut.y} radius={cs}
              fill="#aaaaff" listening={false} />,
          )
        }
        if (a.cpIn.x !== a.x || a.cpIn.y !== a.y) {
          elems.push(
            <Line key={`cin-l-${i}`} points={[a.x, a.y, a.cpIn.x, a.cpIn.y]}
              stroke="#aaaaff" strokeWidth={1 / z} listening={false} />,
            <Circle key={`cin-c-${i}`} x={a.cpIn.x} y={a.cpIn.y} radius={cs}
              fill="#aaaaff" listening={false} />,
          )
        }
      })

      return <>{elems}</>
    }

    if (!drawing || !preview) return null

    if (tool === 'rect') {
      const [sx, sy, w, h] = drawing.points
      return (
        <Rect
          x={sx} y={sy} width={w} height={h}
          stroke={previewColor} strokeWidth={1.5} dash={dash}
          fill="rgba(0,229,255,0.04)" listening={false}
        />
      )
    }
    if (tool === 'ellipse') {
      const [cx, cy, rx, ry] = drawing.points
      return (
        <Ellipse
          x={cx} y={cy} radiusX={Math.abs(rx) || 1} radiusY={Math.abs(ry) || 1}
          stroke={previewColor} strokeWidth={1.5} dash={dash}
          fill="rgba(0,229,255,0.04)" listening={false}
        />
      )
    }
    if (tool === 'polygon' && drawing.points.length >= 6) {
      const first = { x: drawing.points[0], y: drawing.points[1] }
      return (
        <Line
          points={[...drawing.points, first.x, first.y]}
          stroke={previewColor} strokeWidth={1.5} dash={dash} listening={false}
          closed={false}
        />
      )
    }
    return null
  }

  const measureActive = state.activeTool === 'measure'
  const isDraggableStage = spacePanning || state.activePanel === 'race' || state.activePanel === 'preview' || (state.activePanel === 'track' && state.activeTool === 'select')
  const isDrawing = !!drawing || !!penDraw

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-zinc-900">
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={state.zoom}
        scaleY={state.zoom}
        x={state.panX}
        y={state.panY}
        draggable={isDraggableStage}
        onDragEnd={() => {
          const s = stageRef.current
          if (s) dispatch({ type: 'SET_PAN', x: s.x(), y: s.y() })
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
        style={{
          cursor: midPanning || spacePanning
            ? 'grabbing'
            : measureActive
            ? 'crosshair'
            : state.activePanel === 'race' || state.activePanel === 'preview' || state.activeTool === 'select'
            ? 'grab'
            : isDrawing
            ? 'crosshair'
            : 'default',
        }}
      >
        <UnifiedLayer onDblClickShape={(id) => {
          const notMidDraw = !penDraw
          const canEdit =
            state.activeTool === 'select' ||
            (state.activeTool === 'pen' && notMidDraw) ||
            (state.activeTool === 'ruler' && notMidDraw) ||
            (state.activeTool === 'trackrace' && notMidDraw)
          if (!canEdit) return
          const shape = state.trackShapes.find(s => s.id === id)
          if (!shape || shape.type === 'ellipse') return
          if (shape.type === 'pen' || shape.type === 'ruler' || shape.type === 'trackrace') {
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: shape.type })
          } else {
            const penAnchors = shapeToPenAnchors(shape)
            if (!penAnchors) return
            dispatch({ type: 'SNAPSHOT' })
            dispatch({ type: 'UPDATE_SHAPE', id, patch: { type: 'pen', penAnchors, points: [] } })
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'pen' })
          }
          dispatch({ type: 'SET_EDITING_SHAPE', id })
          dispatch({ type: 'SELECT_SHAPE', id })
        }} />
        <MotionPathLayer />
        <HorseLayer />
        <MeasurementLayer active={measureActive} />

        {/* Edit overlay — point handles for the selected shape */}
        <EditOverlay onContinuePen={handleContinuePen} />

        {/* Dashed drawing preview — always on top, non-interactive */}
        <Layer listening={false}>
          {renderPreview()}
        </Layer>
      </Stage>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom * ZOOM_FACTOR })}
          title="Zoom in"
          className="w-8 h-8 flex items-center justify-center bg-panel border border-border rounded text-white hover:bg-border transition-colors"
        >
          <FiZoomIn size={15} />
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom / ZOOM_FACTOR })}
          title="Zoom out"
          className="w-8 h-8 flex items-center justify-center bg-panel border border-border rounded text-white hover:bg-border transition-colors"
        >
          <FiZoomOut size={15} />
        </button>
        <button
          onClick={() => { dispatch({ type: 'SET_ZOOM', zoom: 1 }); dispatch({ type: 'SET_PAN', x: 0, y: 0 }) }}
          title="Reset zoom"
          className="w-8 h-8 flex items-center justify-center bg-panel border border-border rounded text-white hover:bg-border transition-colors"
        >
          <FiMaximize size={14} />
        </button>
        <div className="text-xs text-zinc-400 text-center">{Math.round(state.zoom * 100)}%</div>
      </div>

      {/* Status hint while drawing */}
      {isDrawing && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-xs text-cyan-300 px-3 py-1 rounded pointer-events-none">
          {state.activeTool === 'pen'
            ? 'Click — place anchor · Click+drag — curve · Alt+drag — one-sided · Click start — close · Dbl-click — finish'
            : state.activeTool === 'trackrace'
            ? 'Click — place anchor · Click+drag — curve · Dbl-click — finish'
            : state.activeTool === 'ruler'
            ? 'Click — place point · Click+drag — curve · Alt+drag — one-sided · Dbl-click — finish'
            : 'Release to place shape · Esc to cancel'}
        </div>
      )}
    </div>
  )
}
