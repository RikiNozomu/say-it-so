import { useRef, useEffect } from 'react'
import { Layer, Line, Rect, Ellipse, Path, Group, Transformer, Image as KonvaImage, Circle, Text } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { TrackShape, RefImage } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'
import { anchorsToPath } from '../../utils/pen'
import { penPathLengthPx, samplePathAtRatio, formatRulerLength, intervalToPx } from '../../utils/ruler'
import { sampleTrackPath, buildTrackPolygon, interpolateWidth, trackWidthToPx, formatTrackWidth } from '../../utils/trackrace'

function withAlpha(hex: string, alpha: number): string {
  if (!hex || hex === 'transparent') return 'transparent'
  if (alpha >= 1) return hex
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ── Shape item ──────────────────────────────────────────────────────────────

function ShapeItem({ shape, selected, onDblClick }: { shape: TrackShape; selected: boolean; onDblClick?: () => void }) {
  const { dispatch, state, penDrawing } = useApp()
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const shiftRef = useRef(false)

  useEffect(() => {
    if (!selected) return
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [selected])

  useEffect(() => {
    if (!trRef.current) return
    if (selected && groupRef.current) {
      trRef.current.nodes([groupRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected, shape])

  function bakeTransform() {
    const node = groupRef.current!
    const dx = node.x(), dy = node.y()
    const sx = node.scaleX(), sy = node.scaleY()
    node.x(0); node.y(0); node.scaleX(1); node.scaleY(1); node.rotation(0)
    if (shape.type === 'rect') {
      const [x, y, w, h] = shape.points
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { points: [x * sx + dx, y * sy + dy, w * sx, h * sy] } })
    } else if (shape.type === 'ellipse') {
      const [cx, cy, rx, ry] = shape.points
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { points: [cx * sx + dx, cy * sy + dy, rx * sx, ry * sy] } })
    } else if ((shape.type === 'pen' || shape.type === 'ruler') && shape.penAnchors) {
      const newAnchors = shape.penAnchors.map((a) => ({
        x: a.x * sx + dx, y: a.y * sy + dy,
        cpIn: { x: a.cpIn.x * sx + dx, y: a.cpIn.y * sy + dy },
        cpOut: { x: a.cpOut.x * sx + dx, y: a.cpOut.y * sy + dy },
      }))
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { penAnchors: newAnchors } })
    } else {
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { points: shape.points.map((v, i) => i % 2 === 0 ? v * sx + dx : v * sy + dy) } })
    }
  }

  if (shape.visible === false) return null

  const strokeColor = withAlpha(shape.stroke, shape.strokeAlpha ?? 1)
  const fillColor   = withAlpha(shape.fill, shape.fillAlpha ?? 1)
  // While ANY shape is being edited, the whole UnifiedLayer goes non-interactive
  // so the EditOverlay layer above it receives all pointer events.
  const interactive = !state.editingShapeId
  const common = {
    stroke: strokeColor,
    strokeWidth: shape.strokeWidth,
    fill: fillColor || undefined,
    listening: interactive,
  }

  let inner: React.ReactNode
  if (shape.type === 'rect') {
    const [x, y, w, h] = shape.points
    inner = <Rect x={x} y={y} width={w} height={h} {...common} />
  } else if (shape.type === 'ellipse') {
    const [x, y, rx, ry] = shape.points
    inner = <Ellipse x={x} y={y} radiusX={Math.abs(rx) || 1} radiusY={Math.abs(ry) || 1} {...common} />
  } else if (shape.type === 'pen' && shape.penAnchors) {
    const d = anchorsToPath(shape.penAnchors, shape.closed)
    inner = <Path data={d} {...common} hitStrokeWidth={12} />
  } else {
    inner = <Line points={shape.points} tension={shape.tension ?? (shape.type === 'bezier' ? 0.5 : 0)} closed={shape.closed} hitStrokeWidth={12} {...common} />
  }

  return (
    <>
      <Group
        ref={groupRef}
        draggable={interactive && shape.locked !== true && state.activePanel === 'track'}
        listening={interactive}
        opacity={shape.opacity ?? 1}
        onClick={() => { if (state.activePanel === 'track' && !penDrawing) dispatch({ type: 'SELECT_SHAPE', id: shape.id }) }}
        onDblClick={() => { if (state.activePanel === 'track' && !penDrawing) onDblClick?.() }}
        onDragEnd={bakeTransform}
        onTransformEnd={bakeTransform}
        shadowBlur={selected ? 8 : 0}
        shadowColor="#e94560"
      >
        {inner}
      </Group>
      <Transformer ref={trRef} rotateEnabled keepRatio={false}
        boundBoxFunc={(oldBox, newBox) => {
          const nb = { ...newBox, width: Math.max(4, newBox.width), height: Math.max(4, newBox.height) }
          if (shiftRef.current && oldBox.width !== 0 && oldBox.height !== 0) {
            const ratio = Math.abs(oldBox.width / oldBox.height)
            if (Math.abs(nb.width / oldBox.width) >= Math.abs(nb.height / oldBox.height)) {
              nb.height = nb.width / ratio
            } else {
              nb.width = nb.height * ratio
            }
          }
          return nb
        }}
      />
    </>
  )
}

// ── Ruler item ──────────────────────────────────────────────────────────────

function RulerItem({ shape, selected, onDblClick }: { shape: TrackShape; selected: boolean; onDblClick?: () => void }) {
  const { dispatch, state, penDrawing } = useApp()
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const shiftRef = useRef(false)

  useEffect(() => {
    if (!selected) return
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [selected])

  useEffect(() => {
    if (!trRef.current) return
    if (selected && groupRef.current) {
      trRef.current.nodes([groupRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected, shape])

  function bakeTransform() {
    const node = groupRef.current!
    const dx = node.x(), dy = node.y()
    const sx = node.scaleX(), sy = node.scaleY()
    node.x(0); node.y(0); node.scaleX(1); node.scaleY(1); node.rotation(0)
    if (shape.penAnchors) {
      const newAnchors = shape.penAnchors.map((a) => ({
        x: a.x * sx + dx, y: a.y * sy + dy,
        cpIn:  { x: a.cpIn.x  * sx + dx, y: a.cpIn.y  * sy + dy },
        cpOut: { x: a.cpOut.x * sx + dx, y: a.cpOut.y * sy + dy },
      }))
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { penAnchors: newAnchors } })
    }
  }

  if (shape.visible === false || !shape.penAnchors || shape.penAnchors.length < 1) return null

  const anchors = shape.penAnchors
  const interactive = !state.editingShapeId
  const strokeColor = withAlpha(shape.stroke, shape.strokeAlpha ?? 1)

  const lengthPx = penPathLengthPx(anchors, false)
  const unit = shape.rulerUnit ?? 'm'
  const startLabel = formatRulerLength(0, unit, state.trackScale)
  const endLabel   = formatRulerLength(lengthPx, unit, state.trackScale)

  const fontSize = shape.rulerFontSize ?? 12
  const labelH = fontSize + 8
  const startLabelW = startLabel.length * 7 + 14
  const endLabelW   = endLabel.length   * 7 + 14
  const labelTextColor = withAlpha(shape.rulerLabelColor ?? '#ffffff', shape.rulerLabelColorOpacity ?? 1)
  const labelBgColor   = withAlpha(shape.rulerLabelBg    ?? '#000000', shape.rulerLabelBgOpacity    ?? 0.75)

  // Sequence markers
  const seqInterval = shape.rulerSeqInterval ?? 0
  const seqColor    = withAlpha(shape.rulerSeqColor ?? '#ffdd00', shape.rulerSeqColorOpacity ?? 1)
  const seqMarkers: { x: number; y: number; label: string }[] = []
  if (seqInterval > 0 && anchors.length >= 2) {
    const intervalPx = intervalToPx(seqInterval, unit, state.trackScale)
    if (intervalPx > 0) {
      let d = intervalPx
      while (d < lengthPx - intervalPx * 0.1) {
        const pt = samplePathAtRatio(anchors, d / lengthPx, false)
        seqMarkers.push({ x: pt.x, y: pt.y, label: formatRulerLength(d, unit, state.trackScale) })
        d += intervalPx
      }
    }
  }

  return (
    <>
      <Group
        ref={groupRef}
        draggable={interactive && shape.locked !== true && state.activePanel === 'track'}
        listening={interactive}
        opacity={shape.opacity ?? 1}
        onClick={() => { if (state.activePanel === 'track' && !penDrawing) dispatch({ type: 'SELECT_SHAPE', id: shape.id }) }}
        onDblClick={() => { if (state.activePanel === 'track' && !penDrawing) onDblClick?.() }}
        onDragEnd={bakeTransform}
        onTransformEnd={bakeTransform}
        shadowBlur={selected ? 8 : 0}
        shadowColor="#e94560"
      >
        {/* Dashed path */}
        {anchors.length >= 2 && (
          <Path
            data={anchorsToPath(anchors, false)}
            stroke={strokeColor}
            strokeWidth={shape.strokeWidth}
            dash={[8, 4]}
            fill="transparent"
            hitStrokeWidth={12}
          />
        )}

        {/* Endpoint dots */}
        <Circle x={anchors[0].x} y={anchors[0].y} radius={shape.strokeWidth / 2 + 2} fill={strokeColor} listening={false} />
        {anchors.length >= 2 && (
          <Circle x={anchors[anchors.length - 1].x} y={anchors[anchors.length - 1].y} radius={shape.strokeWidth / 2 + 2} fill={strokeColor} listening={false} />
        )}

        {/* Sequence markers */}
        {seqMarkers.map((m, i) => {
          const sw = m.label.length * 6 + 10
          const sh = 16
          return (
            <Group key={`seq-${i}`} listening={false}>
              <Circle x={m.x} y={m.y} radius={4} fill={seqColor} />
              <Group x={m.x - sw / 2} y={m.y + 7}>
                <Rect width={sw} height={sh} fill={labelBgColor} cornerRadius={2} />
                <Text text={m.label} width={sw} height={sh} fill={seqColor} fontSize={Math.max(8, fontSize - 2)} fontStyle="bold" align="center" verticalAlign="middle" />
              </Group>
            </Group>
          )
        })}

        {/* Start label (0) */}
        <Group x={anchors[0].x - startLabelW / 2} y={anchors[0].y - labelH - 6} listening={false}>
          <Rect width={startLabelW} height={labelH} fill={labelBgColor} cornerRadius={3} />
          <Text text={startLabel} width={startLabelW} height={labelH} fill={labelTextColor} fontSize={fontSize} fontStyle="bold" align="center" verticalAlign="middle" />
        </Group>

        {/* End label (total distance) */}
        {anchors.length >= 2 && (
          <Group x={anchors[anchors.length - 1].x - endLabelW / 2} y={anchors[anchors.length - 1].y - labelH - 6} listening={false}>
            <Rect width={endLabelW} height={labelH} fill={labelBgColor} cornerRadius={3} />
            <Text text={endLabel} width={endLabelW} height={labelH} fill={labelTextColor} fontSize={fontSize} fontStyle="bold" align="center" verticalAlign="middle" />
          </Group>
        )}
      </Group>
      <Transformer ref={trRef} rotateEnabled keepRatio={false}
        boundBoxFunc={(oldBox, newBox) => {
          const nb = { ...newBox, width: Math.max(4, newBox.width), height: Math.max(4, newBox.height) }
          if (shiftRef.current && oldBox.width !== 0 && oldBox.height !== 0) {
            const ratio = Math.abs(oldBox.width / oldBox.height)
            if (Math.abs(nb.width / oldBox.width) >= Math.abs(nb.height / oldBox.height)) {
              nb.height = nb.width / ratio
            } else {
              nb.width = nb.height * ratio
            }
          }
          return nb
        }}
      />
    </>
  )
}

// ── Track Race item ─────────────────────────────────────────────────────────

const SURFACE_FILL: Record<string, string> = {
  turf: '#3d7a3d',
  dirt: '#8b5e3c',
}

function TrackRaceItem({ shape, selected, onDblClick }: { shape: TrackShape; selected: boolean; onDblClick?: () => void }) {
  const { dispatch, state, penDrawing } = useApp()
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const shiftRef = useRef(false)
  const [turfImage] = useImage('/textures/turf.svg')
  const [dirtImage] = useImage('/textures/dirt.svg')

  useEffect(() => {
    if (!selected) return
    const dn = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = true }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') shiftRef.current = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [selected])

  useEffect(() => {
    if (!trRef.current) return
    if (selected && groupRef.current) trRef.current.nodes([groupRef.current])
    else trRef.current.nodes([])
    trRef.current.getLayer()?.batchDraw()
  }, [selected, shape])

  function bakeTransform() {
    const node = groupRef.current!
    const dx = node.x(), dy = node.y()
    const sx = node.scaleX(), sy = node.scaleY()
    node.x(0); node.y(0); node.scaleX(1); node.scaleY(1); node.rotation(0)
    if (shape.penAnchors) {
      const newAnchors = shape.penAnchors.map((a) => ({
        x: a.x * sx + dx, y: a.y * sy + dy,
        cpIn:  { x: a.cpIn.x  * sx + dx, y: a.cpIn.y  * sy + dy },
        cpOut: { x: a.cpOut.x * sx + dx, y: a.cpOut.y * sy + dy },
      }))
      // Scale widths proportionally
      const scale = (sx + sy) / 2
      const newWidths = (shape.trackWidths ?? []).map(w => w * scale)
      const newBorderWidths = (shape.trackBorderWidths ?? []).map(w => w * scale)
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { penAnchors: newAnchors, trackWidths: newWidths, trackBorderWidths: newBorderWidths } })
    }
  }

  if (shape.visible === false || !shape.penAnchors || shape.penAnchors.length < 2) return null

  const anchors = shape.penAnchors
  const anchorCount = anchors.length
  const interactive = !state.editingShapeId
  const unit = shape.trackUnit ?? 'm'
  const surface = shape.trackSurface ?? 'turf'
  const widths = shape.trackWidths ?? anchors.map(() => 20 * state.trackScale)
  const borderWidths = shape.trackBorderWidths ?? anchors.map(() => 3 * state.trackScale)
  const borderColor = withAlpha(shape.trackBorderColor ?? '#ffffff', shape.trackBorderOpacity ?? 1)

  const samples = sampleTrackPath(anchors)
  if (samples.length < 2) return null

  const avgBorderWidth = borderWidths.reduce((a, b) => a + b, 0) / borderWidths.length

  // Two-polygon approach: outer (border colour) sits behind inner (surface texture).
  // Both use the same miter-join polygon builder so corners match cleanly.
  const borderPath = buildTrackPolygon(samples, widths, anchorCount, 'fill', avgBorderWidth)
  const fillPath   = buildTrackPolygon(samples, widths, anchorCount, 'fill', 0)

  const textureImage = surface === 'turf' ? turfImage : dirtImage
  const surfaceFillProps = textureImage
    ? { fillPatternImage: textureImage, fillPatternRepeat: 'repeat' as const }
    : { fill: SURFACE_FILL[surface] }

  // Horse-length tick marks on both borders
  const horseInterval = shape.trackHorseInterval ?? 0
  const tickMarkers: { x: number; y: number; side: 'left' | 'right'; label: string }[] = []
  if (horseInterval > 0) {
    const intervalPx = trackWidthToPx(horseInterval, unit, state.trackScale)
    const totalLen = penPathLengthPx(anchors, false)
    if (intervalPx > 0) {
      let d = intervalPx
      while (d < totalLen - intervalPx * 0.1) {
        const ratio = d / totalLen
        const pt = samplePathAtRatio(anchors, ratio, false)
        const sampleIdx = Math.round(ratio * (samples.length - 1))
        const s = samples[Math.min(sampleIdx, samples.length - 1)]
        const nx = -s.ty, ny = s.tx
        const hw = interpolateWidth(ratio, widths, anchorCount) / 2 + avgBorderWidth
        const label = formatTrackWidth(d, unit, state.trackScale)
        tickMarkers.push({ x: pt.x + nx * hw, y: pt.y + ny * hw, side: 'left', label })
        tickMarkers.push({ x: pt.x - nx * hw, y: pt.y - ny * hw, side: 'right', label })
        d += intervalPx
      }
    }
  }

  return (
    <>
      <Group
        ref={groupRef}
        draggable={interactive && shape.locked !== true && state.activePanel === 'track'}
        listening={interactive}
        opacity={shape.opacity ?? 1}
        onClick={() => { if (state.activePanel === 'track' && !penDrawing) dispatch({ type: 'SELECT_SHAPE', id: shape.id }) }}
        onDblClick={() => { if (state.activePanel === 'track' && !penDrawing) onDblClick?.() }}
        onDragEnd={bakeTransform}
        onTransformEnd={bakeTransform}
        shadowBlur={selected ? 8 : 0}
        shadowColor="#e94560"
      >
        {/* Border: outer polygon filled with border colour */}
        <Path data={borderPath} fill={borderColor} stroke="transparent" strokeWidth={0} listening={true} hitStrokeWidth={0} />

        {/* Surface: inner polygon filled with texture (drawn on top of border) */}
        <Path data={fillPath} {...surfaceFillProps} stroke="transparent" strokeWidth={0} listening={false} />

        {/* Horse-length tick marks */}
        {tickMarkers.map((m, i) => (
          <Group key={`tick-${i}`} listening={false}>
            <Circle x={m.x} y={m.y} radius={3} fill={borderColor} />
            {m.side === 'left' && (
              <Group x={m.x + 4} y={m.y - 8}>
                <Rect width={m.label.length * 6 + 8} height={14} fill="rgba(0,0,0,0.65)" cornerRadius={2} />
                <Text text={m.label} width={m.label.length * 6 + 8} height={14}
                  fill={borderColor} fontSize={9} align="center" verticalAlign="middle" />
              </Group>
            )}
          </Group>
        ))}
      </Group>
      <Transformer ref={trRef} rotateEnabled keepRatio={false}
        boundBoxFunc={(oldBox, newBox) => {
          const nb = { ...newBox, width: Math.max(4, newBox.width), height: Math.max(4, newBox.height) }
          if (shiftRef.current && oldBox.width !== 0 && oldBox.height !== 0) {
            const ratio = Math.abs(oldBox.width / oldBox.height)
            if (Math.abs(nb.width / oldBox.width) >= Math.abs(nb.height / oldBox.height)) nb.height = nb.width / ratio
            else nb.width = nb.height * ratio
          }
          return nb
        }}
      />
    </>
  )
}

// ── Image item ──────────────────────────────────────────────────────────────

function ImageItem({ img, selected }: { img: RefImage; selected: boolean }) {
  const { dispatch, state, penDrawing } = useApp()
  const [image] = useImage(img.dataUrl)
  const nodeRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!trRef.current) return
    if (selected && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected])

  function handleDragEnd() {
    const node = nodeRef.current!
    dispatch({ type: 'UPDATE_REF_IMAGE', id: img.id, patch: { x: node.x(), y: node.y() } })
  }

  function handleTransformEnd() {
    const node = nodeRef.current!
    dispatch({
      type: 'UPDATE_REF_IMAGE', id: img.id,
      patch: {
        x: node.x(), y: node.y(),
        width: Math.max(10, node.width() * node.scaleX()),
        height: Math.max(10, node.height() * node.scaleY()),
        rotation: node.rotation(),
      },
    })
    node.scaleX(1); node.scaleY(1)
  }

  if (img.visible === false) return null

  return (
    <>
      <KonvaImage
        ref={nodeRef}
        image={image}
        x={img.x} y={img.y}
        width={img.width} height={img.height}
        opacity={img.opacity}
        rotation={img.rotation ?? 0}
        draggable={!img.locked && state.activePanel === 'track' && !state.editingShapeId}
        listening={!state.editingShapeId}
        onClick={() => { if (state.activePanel === 'track' && !state.editingShapeId && !penDrawing) dispatch({ type: 'SELECT_REF_IMAGE', id: img.id }) }}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      <Transformer ref={trRef} rotateEnabled
        boundBoxFunc={(_, nb) => ({ ...nb, width: Math.max(10, nb.width), height: Math.max(10, nb.height) })}
      />
    </>
  )
}

// ── Unified layer ───────────────────────────────────────────────────────────

export function UnifiedLayer({ onDblClickShape }: { onDblClickShape?: (id: string) => void }) {
  const { state } = useApp()

  const items = [
    ...state.trackShapes.map((s) => ({ kind: 'shape' as const, order: s.order, id: s.id })),
    ...state.refImages.map((img) => ({ kind: 'image' as const, order: img.order, id: img.id })),
  ].sort((a, b) => a.order - b.order) // ascending: lower order renders first (behind)

  return (
    <Layer>
      {items.map((item) => {
        if (item.kind === 'shape') {
          const shape = state.trackShapes.find((s) => s.id === item.id)!
          if (shape.type === 'ruler') {
            return (
              <RulerItem
                key={item.id} shape={shape}
                selected={state.selectedShapeId === item.id}
                onDblClick={() => onDblClickShape?.(item.id)}
              />
            )
          }
          if (shape.type === 'trackrace') {
            return (
              <TrackRaceItem
                key={item.id} shape={shape}
                selected={state.selectedShapeId === item.id}
                onDblClick={() => onDblClickShape?.(item.id)}
              />
            )
          }
          return (
            <ShapeItem
              key={item.id} shape={shape}
              selected={state.selectedShapeId === item.id}
              onDblClick={() => onDblClickShape?.(item.id)}
            />
          )
        }
        const img = state.refImages.find((img) => img.id === item.id)!
        return <ImageItem key={item.id} img={img} selected={state.selectedRefImageId === item.id} />
      })}
    </Layer>
  )
}
