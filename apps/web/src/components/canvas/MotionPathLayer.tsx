import React, { useRef, useState } from 'react'
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

function screenToCanvas(me: MouseEvent, stage: Konva.Stage) {
  const rect = stage.container().getBoundingClientRect()
  const sc = stage.scaleX()
  return {
    x: (me.clientX - rect.left - stage.x()) / sc,
    y: (me.clientY - rect.top  - stage.y()) / sc,
  }
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

type HandleKind = 'cpOut' | 'cpIn' | 'anchor' | 'anchor-move'

interface DragState {
  kind: HandleKind
  horseId: string
  kfIndex: number
  origX: number; origY: number
  startMx: number; startMy: number
  symmetric: boolean
}

// ── component ─────────────────────────────────────────────────────────────────

export function MotionPathLayer() {
  const { state, dispatch } = useApp()
  const dragRef   = useRef<DragState | null>(null)
  const horseRef  = useRef<typeof state.horses[0] | null>(null)
  const stageRef  = useRef<Konva.Stage | null>(null)
  const [activeKfIdx, setActiveKfIdx] = useState<number | null>(null)

  if (state.activePanel !== 'race') return null

  const visibleHorses = state.horses.filter(h =>
    state.motionPathHorseIds.includes(h.id) && h.keyframes.length >= 1
  )
  if (visibleHorses.length === 0) return null

  // Selected horse — used for handle editing
  const selectedHorse = visibleHorses.find(h => h.id === state.selectedHorseId) ?? null
  if (selectedHorse) horseRef.current = selectedHorse
  const selectedHorseId = selectedHorse?.id ?? null

  const z = state.zoom
  const hs = 5 / z
  const cr = 4 / z

  // sorted keyframes for the selected (editable) horse
  const sorted = selectedHorse
    ? [...selectedHorse.keyframes]
        .map((kf, i) => ({ kf, origIdx: i }))
        .sort((a, b) => a.kf.time - b.kf.time)
    : []

  // ── window-level drag handlers (attached on mousedown) ────────────────────

  function attachDragListeners(stage: Konva.Stage) {
    stageRef.current = stage

    function onMove(me: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      const { x: mx, y: my } = screenToCanvas(me, stage)
      const kf = horseRef.current?.keyframes[d.kfIndex]
      if (!kf) return

      if (d.kind === 'anchor-move') {
        dispatch({ type: 'UPDATE_KEYFRAME_XY_LIVE', horseId: d.horseId, index: d.kfIndex, x: mx, y: my })
      } else if (d.kind === 'anchor') {
        dispatch({ type: 'UPDATE_KEYFRAME_CP_LIVE', horseId: d.horseId, index: d.kfIndex,
          cpOut: { x: mx, y: my },
          cpIn:  { x: 2 * kf.x - mx, y: 2 * kf.y - my },
        })
      } else if (d.kind === 'cpOut') {
        const cpInVal = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
        dispatch({ type: 'UPDATE_KEYFRAME_CP_LIVE', horseId: d.horseId, index: d.kfIndex, cpOut: { x: mx, y: my }, cpIn: cpInVal })
      } else {
        const cpOutVal = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
        dispatch({ type: 'UPDATE_KEYFRAME_CP_LIVE', horseId: d.horseId, index: d.kfIndex, cpIn: { x: mx, y: my }, cpOut: cpOutVal })
      }
    }

    function onUp(me: MouseEvent) {
      const d = dragRef.current
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)

      if (!d) return
      const { x: mx, y: my } = screenToCanvas(me, stage)
      const kf = horseRef.current?.keyframes[d.kfIndex]
      if (!kf) return
      const snap = 12 / stage.scaleX()

      if (d.kind === 'anchor-move') {
        dispatch({ type: 'UPDATE_KEYFRAME_XY', horseId: d.horseId, index: d.kfIndex, x: mx, y: my })
        return
      }

      if (d.kind === 'anchor') {
        if (Math.hypot(mx - d.startMx, my - d.startMy) < snap) {
          // Tiny move = click: reset to corner
          dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex,
            cpIn: { x: kf.x, y: kf.y }, cpOut: { x: kf.x, y: kf.y } })
        } else {
          dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex,
            cpOut: { x: mx, y: my },
            cpIn:  { x: 2 * kf.x - mx, y: 2 * kf.y - my },
          })
        }
        return
      }

      // Handle dragged back near anchor → reset
      if (Math.hypot(mx - kf.x, my - kf.y) < snap) {
        dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex,
          cpIn: { x: kf.x, y: kf.y }, cpOut: { x: kf.x, y: kf.y } })
        return
      }

      if (d.kind === 'cpOut') {
        const cpInVal = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
        dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex, cpOut: { x: mx, y: my }, cpIn: cpInVal })
      } else {
        const cpOutVal = d.symmetric ? { x: 2 * kf.x - mx, y: 2 * kf.y - my } : undefined
        dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: d.horseId, index: d.kfIndex, cpIn: { x: mx, y: my }, cpOut: cpOutVal })
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── mousedown: hit detection only ────────────────────────────────────────

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.evt.button !== 0) return
    if (!selectedHorseId) return   // no editable horse
    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)

    for (const { kf, origIdx } of sorted) {
      const out = cpOut(kf), inn = cpIn(kf)
      const hasCpOut = kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)
      const hasCpIn  = kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y)

      if (hasCpOut && Math.hypot(mx - out.x, my - out.y) < cr * 2) {
        dispatch({ type: 'SNAPSHOT' })
        dragRef.current = { kind: 'cpOut', horseId: selectedHorseId, kfIndex: origIdx, origX: out.x, origY: out.y, startMx: mx, startMy: my, symmetric: !e.evt.altKey }
        attachDragListeners(stage)
        return
      }
      if (hasCpIn && Math.hypot(mx - inn.x, my - inn.y) < cr * 2) {
        dispatch({ type: 'SNAPSHOT' })
        dragRef.current = { kind: 'cpIn', horseId: selectedHorseId, kfIndex: origIdx, origX: inn.x, origY: inn.y, startMx: mx, startMy: my, symmetric: !e.evt.altKey }
        attachDragListeners(stage)
        return
      }
      if (Math.abs(mx - kf.x) <= hs * 1.5 && Math.abs(my - kf.y) <= hs * 1.5) {
        dispatch({ type: 'SNAPSHOT' })
        setActiveKfIdx(origIdx)
        const kind: HandleKind = (e.evt.ctrlKey || e.evt.metaKey) ? 'anchor' : 'anchor-move'
        dragRef.current = { kind, horseId: selectedHorseId, kfIndex: origIdx, origX: kf.x, origY: kf.y, startMx: mx, startMy: my, symmetric: true }
        attachDragListeners(stage)
        return
      }
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Layer onMouseDown={handleMouseDown}>
      <Rect x={-100000} y={-100000} width={200000} height={200000} fill="transparent" listening={true} />

      {/* Render each visible horse */}
      {visibleHorses.map(horse => {
        const isEditable = horse.id === selectedHorseId
        const horseSorted = [...horse.keyframes].sort((a, b) => a.time - b.time)
        const pathD = bezierPathD(horseSorted)

        return (
          <React.Fragment key={horse.id}>
            {/* Dotted bezier path */}
            {pathD && (
              <Path data={pathD} stroke="#e94560" strokeWidth={1.5 / z} dash={[6 / z, 4 / z]}
                fill="transparent" listening={false} opacity={isEditable ? 0.9 : 0.4} />
            )}

            {horseSorted.map((kf, sortedIdx) => {
              const origIdx = horse.keyframes.indexOf(kf)
              const out = cpOut(kf), inn = cpIn(kf)
              const hasCpOut = kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)
              const hasCpIn  = kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y)
              const isActive = isEditable && activeKfIdx === origIdx

              return (
                <React.Fragment key={sortedIdx}>
                  {/* Handle guide lines — editable horse only */}
                  {isEditable && (hasCpOut || isActive) && (
                    <Line points={[kf.x, kf.y, out.x, out.y]}
                      stroke="#e94560" strokeWidth={1 / z} opacity={0.5} listening={false} dash={[3/z, 2/z]} />
                  )}
                  {isEditable && (hasCpIn || isActive) && (
                    <Line points={[kf.x, kf.y, inn.x, inn.y]}
                      stroke="#e94560" strokeWidth={1 / z} opacity={0.5} listening={false} dash={[3/z, 2/z]} />
                  )}
                  {/* Handle circles — editable horse only */}
                  {isEditable && (hasCpOut || isActive) && (
                    <Circle x={out.x} y={out.y} radius={cr}
                      fill="#ff6b8a" stroke="#fff" strokeWidth={0.5 / z} listening={false} />
                  )}
                  {isEditable && (hasCpIn || isActive) && (
                    <Circle x={inn.x} y={inn.y} radius={cr}
                      fill="#ff6b8a" stroke="#fff" strokeWidth={0.5 / z} listening={false} />
                  )}
                  {/* Anchor square */}
                  <Rect
                    x={kf.x - (isActive ? hs * 1.4 : hs)} y={kf.y - (isActive ? hs * 1.4 : hs)}
                    width={isActive ? hs * 2.8 : hs * 2} height={isActive ? hs * 2.8 : hs * 2}
                    fill={isActive ? '#fff' : '#e94560'} stroke={isActive ? '#e94560' : '#fff'}
                    strokeWidth={1 / z} opacity={isEditable ? 1 : 0.4} listening={false}
                  />
                </React.Fragment>
              )
            })}
          </React.Fragment>
        )
      })}
    </Layer>
  )
}
