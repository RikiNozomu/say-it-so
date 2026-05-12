import { useRef, useEffect } from 'react'
import { Layer, Line, Rect, Ellipse, Group, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { TrackShape } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

function ShapeItem({ shape, selected }: { shape: TrackShape; selected: boolean }) {
  const { dispatch } = useApp()
  const groupRef = useRef<Konva.Group>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!trRef.current) return
    if (selected && groupRef.current) {
      trRef.current.nodes([groupRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected, shape])

  // Bake the group's current transform back into the shape's points/dims
  function bakeTransform() {
    const node = groupRef.current!
    const dx = node.x()
    const dy = node.y()
    const sx = node.scaleX()
    const sy = node.scaleY()
    node.x(0); node.y(0); node.scaleX(1); node.scaleY(1); node.rotation(0)

    if (shape.type === 'rect') {
      const [x, y, w, h] = shape.points
      dispatch({
        type: 'UPDATE_SHAPE', id: shape.id,
        patch: { points: [x * sx + dx, y * sy + dy, w * sx, h * sy] },
      })
    } else if (shape.type === 'ellipse') {
      const [cx, cy, rx, ry] = shape.points
      dispatch({
        type: 'UPDATE_SHAPE', id: shape.id,
        patch: { points: [cx * sx + dx, cy * sy + dy, rx * sx, ry * sy] },
      })
    } else {
      // line, bezier, polygon: transform each point
      const pts = shape.points.map((v, i) =>
        i % 2 === 0 ? v * sx + dx : v * sy + dy,
      )
      dispatch({ type: 'UPDATE_SHAPE', id: shape.id, patch: { points: pts } })
    }
  }

  const common = {
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    fill: shape.fill || undefined,
    opacity: shape.opacity ?? 1,
    listening: true,
  }

  let inner: React.ReactNode
  if (shape.type === 'rect') {
    const [x, y, w, h] = shape.points
    inner = <Rect x={x} y={y} width={w} height={h} {...common} />
  } else if (shape.type === 'ellipse') {
    const [x, y, rx, ry] = shape.points
    inner = <Ellipse x={x} y={y} radiusX={Math.abs(rx) || 1} radiusY={Math.abs(ry) || 1} {...common} />
  } else {
    inner = (
      <Line
        points={shape.points}
        tension={shape.tension ?? (shape.type === 'bezier' ? 0.5 : 0)}
        closed={shape.closed}
        hitStrokeWidth={12}
        {...common}
      />
    )
  }

  if (shape.visible === false) return null

  return (
    <>
      <Group
        ref={groupRef}
        draggable={shape.locked !== true}
        opacity={shape.opacity ?? 1}
        onClick={() => dispatch({ type: 'SELECT_SHAPE', id: shape.id })}
        onDragEnd={bakeTransform}
        onTransformEnd={bakeTransform}
        shadowBlur={selected ? 8 : 0}
        shadowColor="#e94560"
      >
        {inner}
      </Group>
      <Transformer
        ref={trRef}
        rotateEnabled
        keepRatio={false}
        boundBoxFunc={(_, newBox) => ({
          ...newBox,
          width: Math.max(4, newBox.width),
          height: Math.max(4, newBox.height),
        })}
      />
    </>
  )
}

export function TrackLayer() {
  const { state } = useApp()
  const sorted = [...state.trackShapes].sort((a, b) => a.order - b.order)
  return (
    <Layer>
      {sorted.map((s) => (
        <ShapeItem key={s.id} shape={s} selected={state.selectedShapeId === s.id} />
      ))}
    </Layer>
  )
}
