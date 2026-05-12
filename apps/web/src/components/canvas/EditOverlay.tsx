import { useRef, useState } from 'react'
import { Layer, Circle, Rect, Line, Path } from 'react-konva'
import type Konva from 'konva'
import { useApp } from '../../context/AppContext'
import { anchorsToPath } from '../../utils/pen'
import type { PenAnchor } from '../../utils/pen'

// ── geometry ────────────────────────────────────────────────────────────────

function ptOnCubic(
  px: number, py: number,
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x1: number, y1: number,
): { x: number; y: number; t: number; dist: number } {
  let best = { t: 0, dist: Infinity, x: x0, y: y0 }
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, mt = 1 - t
    const bx = mt**3*x0 + 3*mt**2*t*cx1 + 3*mt*t**2*cx2 + t**3*x1
    const by = mt**3*y0 + 3*mt**2*t*cy1 + 3*mt*t**2*cy2 + t**3*y1
    const dist = Math.hypot(px - bx, py - by)
    if (dist < best.dist) best = { t, dist, x: bx, y: by }
  }
  return best
}

function splitCubic(
  x0: number, y0: number, cx1: number, cy1: number,
  cx2: number, cy2: number, x1: number, y1: number, t: number,
) {
  const mt = 1 - t
  const p10x = mt*x0 + t*cx1,   p10y = mt*y0 + t*cy1
  const p11x = mt*cx1 + t*cx2,  p11y = mt*cy1 + t*cy2
  const p12x = mt*cx2 + t*x1,   p12y = mt*cy2 + t*y1
  const p20x = mt*p10x + t*p11x, p20y = mt*p10y + t*p11y
  const p21x = mt*p11x + t*p12x, p21y = mt*p11y + t*p12y
  const mx = mt*p20x + t*p21x,   my = mt*p20y + t*p21y
  return {
    left:  { cpOut: { x: p10x, y: p10y } },
    mid:   { x: mx, y: my, cpIn: { x: p20x, y: p20y }, cpOut: { x: p21x, y: p21y } },
    right: { cpIn: { x: p12x, y: p12y } },
  }
}

function canvasPos(stage: Konva.Stage) {
  const pos = stage.getPointerPosition()!
  const sc = stage.scaleX()
  return { x: (pos.x - stage.x()) / sc, y: (pos.y - stage.y()) / sc }
}

// ── drag state ───────────────────────────────────────────────────────────────

type DragKind = 'anchor' | 'cpOut' | 'cpIn' | 'new-anchor'

interface DragState {
  kind: DragKind
  idx: number              // anchor index
  origAnchor: PenAnchor    // snapshot at drag start
  startX: number; startY: number
  altKey: boolean
  hasMoved: boolean
}

// ── EditOverlay ──────────────────────────────────────────────────────────────

export function EditOverlay({
  onContinuePen,
}: {
  onContinuePen: (shapeId: string, anchors: PenAnchor[], fromEnd: 'start' | 'end') => void
}) {
  const { state, dispatch } = useApp()
  const dragRef = useRef<DragState | null>(null)
  const anchorsRef = useRef<PenAnchor[]>([])
  // Index of the endpoint that would be snapped-to-close if the drag is released
  const [closingHint, setClosingHint] = useState<number | null>(null)

  const { editingShapeId } = state
  if (!editingShapeId) return null
  const shape = state.trackShapes.find((s) => s.id === editingShapeId)
  if (!shape || shape.type !== 'pen' || !shape.penAnchors) return null

  // Keep ref in sync
  anchorsRef.current = shape.penAnchors

  const z = state.zoom
  const hs = 6 / z    // anchor half-size (screen px)
  const cs = 4 / z    // control handle radius
  const SNAP = 14 / z // click tolerance
  const MOVE_THRESHOLD = 4 / z

  function save(anchors: PenAnchor[]) {
    dispatch({ type: 'SNAPSHOT' })
    dispatch({ type: 'UPDATE_SHAPE', id: shape!.id, patch: { penAnchors: anchors } })
  }

  function live(anchors: PenAnchor[]) {
    dispatch({ type: 'UPDATE_SHAPE_LIVE', id: shape!.id, patch: { penAnchors: anchors } })
  }

  // ── click actions ──────────────────────────────────────────────────────────

  function removeAnchor(idx: number) {
    const ancs = anchorsRef.current
    if (ancs.length <= 2) return
    save([...ancs.slice(0, idx), ...ancs.slice(idx + 1)])
  }

  function toggleCornerSmooth(idx: number) {
    const ancs = [...anchorsRef.current]
    const a = ancs[idx]
    const isCorner = a.cpOut.x === a.x && a.cpOut.y === a.y
    if (isCorner) {
      const prev = ancs[(idx - 1 + ancs.length) % ancs.length]
      const next = ancs[(idx + 1) % ancs.length]
      const dx = (next.x - prev.x) / 4
      const dy = (next.y - prev.y) / 4
      ancs[idx] = { ...a, cpOut: { x: a.x + dx, y: a.y + dy }, cpIn: { x: a.x - dx, y: a.y - dy } }
    } else {
      ancs[idx] = { ...a, cpIn: { x: a.x, y: a.y }, cpOut: { x: a.x, y: a.y } }
    }
    save(ancs)
  }

  // ── mouse events ──────────────────────────────────────────────────────────

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)
    const altKey = e.evt.altKey
    const ancs = anchorsRef.current

    // 1. Check control handles (cpOut / cpIn) first — smaller targets, checked before anchors
    for (let i = 0; i < ancs.length; i++) {
      const a = ancs[i]
      const hasOut = a.cpOut.x !== a.x || a.cpOut.y !== a.y
      const hasIn  = a.cpIn.x  !== a.x || a.cpIn.y  !== a.y
      if (hasOut && Math.hypot(mx - a.cpOut.x, my - a.cpOut.y) < cs * 1.5) {
        dragRef.current = { kind: 'cpOut', idx: i, origAnchor: { ...a }, startX: mx, startY: my, altKey, hasMoved: false }
        return
      }
      if (hasIn && Math.hypot(mx - a.cpIn.x, my - a.cpIn.y) < cs * 1.5) {
        dragRef.current = { kind: 'cpIn', idx: i, origAnchor: { ...a }, startX: mx, startY: my, altKey, hasMoved: false }
        return
      }
    }

    // 2. Check anchor squares
    for (let i = 0; i < ancs.length; i++) {
      const a = ancs[i]
      if (Math.abs(mx - a.x) <= hs && Math.abs(my - a.y) <= hs) {
        dragRef.current = { kind: 'anchor', idx: i, origAnchor: { ...a }, startX: mx, startY: my, altKey, hasMoved: false }
        return
      }
    }

    // 3. Check segment — insert a new anchor
    const all = shape!.closed ? [...ancs, ancs[0]] : ancs
    let bestSeg = -1, bestT = 0, bestDist = Infinity, bestX = 0, bestY = 0
    for (let i = 0; i < all.length - 1; i++) {
      const a0 = all[i], a1 = all[i + 1]
      const res = ptOnCubic(mx, my, a0.x, a0.y, a0.cpOut.x, a0.cpOut.y, a1.cpIn.x, a1.cpIn.y, a1.x, a1.y)
      if (res.dist < bestDist) { bestDist = res.dist; bestSeg = i; bestT = res.t; bestX = res.x; bestY = res.y }
    }
    if (bestDist > SNAP) return

    // Split and insert
    const a0 = all[bestSeg], a1 = all[(bestSeg + 1) % ancs.length]
    const sp = splitCubic(a0.x, a0.y, a0.cpOut.x, a0.cpOut.y, a1.cpIn.x, a1.cpIn.y, a1.x, a1.y, bestT)
    const newAnc: PenAnchor = { x: bestX, y: bestY, cpIn: { x: bestX, y: bestY }, cpOut: { x: bestX, y: bestY } }
    const insertIdx = bestSeg + 1
    const na = [...ancs]
    na[bestSeg] = { ...a0, cpOut: sp.left.cpOut }
    na.splice(insertIdx, 0, newAnc)
    const afterIdx = shape!.closed ? (insertIdx + 1) % na.length : insertIdx + 1
    if (na[afterIdx]) na[afterIdx] = { ...na[afterIdx], cpIn: sp.right.cpIn }

    live(na)
    anchorsRef.current = na
    dragRef.current = { kind: 'new-anchor', idx: insertIdx, origAnchor: { ...newAnc }, startX: mx, startY: my, altKey, hasMoved: false }
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const d = dragRef.current
    if (!d) return
    const stage = e.target.getStage()
    if (!stage) return
    const { x: mx, y: my } = canvasPos(stage)
    const dist = Math.hypot(mx - d.startX, my - d.startY)
    if (dist > MOVE_THRESHOLD) d.hasMoved = true

    const ancs = [...anchorsRef.current]
    const a = ancs[d.idx]

    if (d.kind === 'anchor' || d.kind === 'new-anchor') {
      const dx = mx - d.origAnchor.x, dy = my - d.origAnchor.y
      if (d.kind === 'new-anchor') {
        ancs[d.idx] = {
          x: d.origAnchor.x, y: d.origAnchor.y,
          cpOut: { x: mx, y: my },
          cpIn:  { x: 2 * d.origAnchor.x - mx, y: 2 * d.origAnchor.y - my },
        }
      } else {
        ancs[d.idx] = {
          x: mx, y: my,
          cpIn:  { x: d.origAnchor.cpIn.x  + dx, y: d.origAnchor.cpIn.y  + dy },
          cpOut: { x: d.origAnchor.cpOut.x + dx, y: d.origAnchor.cpOut.y + dy },
        }
        // Snap-to-close: highlight the opposite endpoint when dragging this endpoint near it
        if (!shape!.closed && (d.idx === 0 || d.idx === ancs.length - 1)) {
          const otherIdx = d.idx === 0 ? ancs.length - 1 : 0
          const other = ancs[otherIdx]
          const near = Math.hypot(mx - other.x, my - other.y) < SNAP * 1.5
          setClosingHint(near ? otherIdx : null)
        }
      }
    } else if (d.kind === 'cpOut') {
      // Alt held = break symmetry: move only this handle independently
      if (e.evt.altKey) {
        ancs[d.idx] = { ...a, cpOut: { x: mx, y: my } }
      } else {
        ancs[d.idx] = { ...a, cpOut: { x: mx, y: my }, cpIn: { x: 2 * a.x - mx, y: 2 * a.y - my } }
      }
    } else if (d.kind === 'cpIn') {
      if (e.evt.altKey) {
        ancs[d.idx] = { ...a, cpIn: { x: mx, y: my } }
      } else {
        ancs[d.idx] = { ...a, cpIn: { x: mx, y: my }, cpOut: { x: 2 * a.x - mx, y: 2 * a.y - my } }
      }
    }

    live(ancs)
    anchorsRef.current = ancs
  }

  function handleMouseUp(_e: Konva.KonvaEventObject<MouseEvent>) {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null

    const ancs = anchorsRef.current

    if (d.hasMoved) {
      setClosingHint(null)
      // Endpoint dragged near the other endpoint → close path
      if (d.kind === 'anchor' && !shape!.closed && (d.idx === 0 || d.idx === ancs.length - 1)) {
        const otherIdx = d.idx === 0 ? ancs.length - 1 : 0
        const other = ancs[otherIdx]
        if (Math.hypot(ancs[d.idx].x - other.x, ancs[d.idx].y - other.y) < SNAP * 1.5) {
          // Snap dragged endpoint onto the other, then close
          const delta = { x: other.x - ancs[d.idx].x, y: other.y - ancs[d.idx].y }
          const merged = [...ancs]
          merged[d.idx] = {
            x: other.x, y: other.y,
            cpIn:  { x: merged[d.idx].cpIn.x  + delta.x, y: merged[d.idx].cpIn.y  + delta.y },
            cpOut: { x: merged[d.idx].cpOut.x + delta.x, y: merged[d.idx].cpOut.y + delta.y },
          }
          dispatch({ type: 'SNAPSHOT' })
          dispatch({ type: 'UPDATE_SHAPE', id: shape!.id, patch: {
            penAnchors: merged,
            closed: true,
            fillAlpha: (shape!.fillAlpha ?? 0) > 0 ? shape!.fillAlpha : 0.3,
          }})
          return
        }
      }
      save(ancs)
      return
    }

    // ── It was a click (no movement) ──────────────────────────────────────
    if (d.kind === 'anchor') {
      if (d.altKey) {
        toggleCornerSmooth(d.idx)
        return
      }
      const isEndpoint = !shape!.closed && (d.idx === 0 || d.idx === ancs.length - 1)
      if (isEndpoint) {
        onContinuePen(shape!.id, ancs, d.idx === 0 ? 'start' : 'end')
      } else {
        removeAnchor(d.idx)
      }
      return
    }

    if (d.kind === 'new-anchor') {
      // Segment click without drag → commit corner anchor (no handles)
      save(ancs)
      return
    }

    if (d.kind === 'cpOut' || d.kind === 'cpIn') {
      if (d.altKey) {
        // Alt+click handle = break symmetry (independent handles)
        // Just commit as-is (handles already set individually)
        save(ancs)
      }
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const ancs = shape.penAnchors
  const elems: React.ReactNode[] = []

  // Dashed outline of the path so user can see curve shape while editing
  if (ancs.length >= 2) {
    elems.push(
      <Path key="path-outline" data={anchorsToPath(ancs, shape.closed)}
        stroke="#00e5ff" strokeWidth={1 / z} dash={[5 / z, 3 / z]}
        fill="transparent" listening={false} opacity={0.5} />
    )
  }

  ancs.forEach((a, i) => {
    const isEndpoint = !shape.closed && (i === 0 || i === ancs.length - 1)
    const isSmooth = a.cpOut.x !== a.x || a.cpOut.y !== a.y || a.cpIn.x !== a.x || a.cpIn.y !== a.y

    // Guide lines + control handles
    if (a.cpOut.x !== a.x || a.cpOut.y !== a.y) {
      elems.push(
        <Line key={`ol-${i}`} points={[a.x, a.y, a.cpOut.x, a.cpOut.y]}
          stroke="#6060dd" strokeWidth={1 / z} listening={false} />,
        <Circle key={`oh-${i}`} x={a.cpOut.x} y={a.cpOut.y} radius={cs}
          fill="#8080ff" stroke="#ddd" strokeWidth={0.5 / z} listening={false} />
      )
    }
    if (a.cpIn.x !== a.x || a.cpIn.y !== a.y) {
      elems.push(
        <Line key={`il-${i}`} points={[a.x, a.y, a.cpIn.x, a.cpIn.y]}
          stroke="#6060dd" strokeWidth={1 / z} listening={false} />,
        <Circle key={`ih-${i}`} x={a.cpIn.x} y={a.cpIn.y} radius={cs}
          fill="#8080ff" stroke="#ddd" strokeWidth={0.5 / z} listening={false} />
      )
    }

    // Anchor square — colour-coded: orange=endpoint, white=smooth, grey=corner
    elems.push(
      <Rect key={`anc-${i}`}
        x={a.x - hs} y={a.y - hs} width={hs * 2} height={hs * 2}
        fill={isEndpoint ? '#ff9900' : isSmooth ? '#ffffff' : '#aaaaaa'}
        stroke="#00e5ff" strokeWidth={1 / z}
        listening={false}
      />
    )
  })

  // Snap-to-close ring: glowing circle around the target endpoint
  if (closingHint !== null && ancs[closingHint]) {
    const ta = ancs[closingHint]
    elems.push(
      <Circle key="close-hint" x={ta.x} y={ta.y} radius={hs * 2.5}
        stroke="#00ff88" strokeWidth={2 / z} fill="rgba(0,255,136,0.15)" listening={false} />
    )
  }

  return (
    <Layer
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Full-coverage transparent rect so Konva hit-detection reaches this layer's handlers */}
      <Rect x={-100000} y={-100000} width={200000} height={200000} fill="transparent" listening={true} />
      {elems}
    </Layer>
  )
}
