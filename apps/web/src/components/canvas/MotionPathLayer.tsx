import React, { useRef } from 'react'
import { Layer, Path, Circle, Line, Rect } from 'react-konva'
import type Konva from 'konva'
import { useApp } from '../../context/AppContext'
import type { Keyframe } from '@say-it-so/core'

// ── geometry ─────────────────────────────────────────────────────────────────

function canvasPos(stage: Konva.Stage) {
  const pos = stage.getPointerPosition()!
  const sc = stage.scaleX()
  return { x: (pos.x - stage.x()) / sc, y: (pos.y - stage.y()) / sc }
}

function cpOut(kf: Keyframe) { return kf.cpOut ?? { x: kf.x, y: kf.y } }
function cpIn(kf: Keyframe)  { return kf.cpIn  ?? { x: kf.x, y: kf.y } }

function bezierPathD(sorted: Keyframe[]): string {
  if (sorted.length < 2) return ''
  const parts: string[] = [`M ${sorted[0].x} ${sorted[0].y}`]
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]
    const c1 = cpOut(a), c2 = cpIn(b)
    parts.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`)
  }
  return parts.join(' ')
}

// ── drag state ────────────────────────────────────────────────────────────────

type HandleKind = 'cpOut' | 'cpIn' | 'anchor'

interface DragState {
  kind: HandleKind
  horseId: string
  kfIndex: number          // index in horse.keyframes (unsorted)
  origX: number; origY: number
  startMx: number; startMy: number
  symmetric: boolean       // mirror opposite handle when dragging
}

// ── component ─────────────────────────────────────────────────────────────────

export function MotionPathLayer() {
  const { state, dispatch } = useApp()
  const dragRef = useRef<DragState | null>(null)
  const horseRef = useRef<typeof state.horses[0] | null>(null)

  if (state.activePanel !== 'horses' || !state.showMotionPaths) return null

  const selectedHorse = state.horses.find(h => h.id === state.selectedHorseId)
  if (!selectedHorse || selectedHorse.keyframes.length < 1) return null

  horseRef.current = selectedHorse
  const selectedHorseId = selectedHorse.id

  const z = state.zoom
  const hs = 5 / z   // anchor half-size
  const cr = 4 / z   // handle circle radius
  const SNAP = 12 / z

  // Sort keyframes by time; keep original index for dispatch
  const sorted = [...selectedHorse.keyframes]
    .map((kf, i) => ({ kf, origIdx: i }))
    .sort((a, b) => a.kf.time - b.kf.time)

  // ── mouse handlers ────────────────────────────────────────────────────────

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return
    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)

    for (const { kf, origIdx } of sorted) {
      const out = cpOut(kf), inn = cpIn(kf)
      const hasCpOut = kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)
      const hasCpIn  = kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y)

      // cpOut handle
      if (hasCpOut && Math.hypot(mx - out.x, my - out.y) < cr * 2) {
        dispatch({ type: 'SNAPSHOT' })
        dragRef.current = { kind: 'cpOut', horseId: selectedHorseId, kfIndex: origIdx, origX: out.x, origY: out.y, startMx: mx, startMy: my, symmetric: !e.evt.altKey }
        return
      }
      // cpIn handle
      if (hasCpIn && Math.hypot(mx - inn.x, my - inn.y) < cr * 2) {
        dispatch({ type: 'SNAPSHOT' })
        dragRef.current = { kind: 'cpIn', horseId: selectedHorseId, kfIndex: origIdx, origX: inn.x, origY: inn.y, startMx: mx, startMy: my, symmetric: !e.evt.altKey }
        return
      }
      // anchor square — click to activate smooth handles
      if (Math.abs(mx - kf.x) <= hs * 1.5 && Math.abs(my - kf.y) <= hs * 1.5) {
        dragRef.current = { kind: 'anchor', horseId: selectedHorseId, kfIndex: origIdx, origX: kf.x, origY: kf.y, startMx: mx, startMy: my, symmetric: false }
        return
      }
    }
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const d = dragRef.current
    if (!d || d.kind === 'anchor') return
    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)

    const kf = horseRef.current?.keyframes[d.kfIndex]
    if (!kf) return

    if (d.kind === 'cpOut') {
      const cpIn = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
      dispatch({ type: 'UPDATE_KEYFRAME_CP_LIVE', horseId: d.horseId, index: d.kfIndex, cpOut: { x: mx, y: my }, cpIn })
    } else {
      const cpOut = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
      dispatch({ type: 'UPDATE_KEYFRAME_CP_LIVE', horseId: d.horseId, index: d.kfIndex, cpIn: { x: mx, y: my }, cpOut })
    }
  }

  function handleMouseUp(e: Konva.KonvaEventObject<MouseEvent>) {
    const d = dragRef.current
    dragRef.current = null
    if (!d || d.kind === 'anchor') return

    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)

    const kf = horseRef.current?.keyframes[d.kfIndex]
    if (!kf) return

    // Handle dragged back near anchor → reset to corner point
    if (Math.hypot(mx - kf.x, my - kf.y) < SNAP) {
      dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex,
        cpIn: { x: kf.x, y: kf.y }, cpOut: { x: kf.x, y: kf.y } })
      return
    }

    if (d.kind === 'cpOut') {
      const cpIn = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
      dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex, cpOut: { x: mx, y: my }, cpIn })
    } else {
      const cpOut = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
      dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex, cpIn: { x: mx, y: my }, cpOut })
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const kfs = sorted.map(s => s.kf)
  const pathD = bezierPathD(kfs)

  return (
    <Layer onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Full-coverage rect so Layer receives all mouse events */}
      <Rect x={-100000} y={-100000} width={200000} height={200000} fill="transparent" listening={true} />

      {/* Dotted bezier path */}
      {pathD && (
        <Path
          data={pathD}
          stroke="#e94560"
          strokeWidth={1.5 / z}
          dash={[6 / z, 4 / z]}
          fill="transparent"
          listening={false}
          opacity={0.8}
        />
      )}

      {sorted.map(({ kf, origIdx }) => {
        const out = cpOut(kf)
        const inn = cpIn(kf)
        const hasCpOut = kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)
        const hasCpIn  = kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y)

        return (
          <React.Fragment key={origIdx}>
            {/* Handle guide lines */}
            {hasCpOut && (
              <Line points={[kf.x, kf.y, out.x, out.y]}
                stroke="#e94560" strokeWidth={1 / z} opacity={0.5} listening={false} dash={[3/z, 2/z]} />
            )}
            {hasCpIn && (
              <Line points={[kf.x, kf.y, inn.x, inn.y]}
                stroke="#e94560" strokeWidth={1 / z} opacity={0.5} listening={false} dash={[3/z, 2/z]} />
            )}

            {/* cpOut handle */}
            {hasCpOut && (
              <Circle x={out.x} y={out.y} radius={cr}
                fill="#ff6b8a" stroke="#fff" strokeWidth={0.5 / z} listening={false} />
            )}
            {/* cpIn handle */}
            {hasCpIn && (
              <Circle x={inn.x} y={inn.y} radius={cr}
                fill="#ff6b8a" stroke="#fff" strokeWidth={0.5 / z} listening={false} />
            )}

            {/* Keyframe anchor square */}
            <Rect
              x={kf.x - hs} y={kf.y - hs} width={hs * 2} height={hs * 2}
              fill="#e94560" stroke="#fff" strokeWidth={1 / z}
              listening={false}
            />
          </React.Fragment>
        )
      })}
    </Layer>
  )
}
