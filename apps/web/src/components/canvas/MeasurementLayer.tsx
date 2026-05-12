import { useState } from 'react'
import { Layer, Line, Circle, Text, Group } from 'react-konva'
import { useApp } from '../../context/AppContext'
import { measureDistance } from '@say-it-so/core'
import { useUnit } from '../../hooks/useUnit'
import type Konva from 'konva'

interface MeasureLine {
  id: string
  x1: number; y1: number
  x2: number; y2: number
}

interface MeasurementLayerProps {
  active: boolean
}

export function MeasurementLayer({ active }: MeasurementLayerProps) {
  const { state } = useApp()
  const unit = useUnit()
  const [lines, setLines] = useState<MeasureLine[]>([])
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!active) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    // account for zoom/pan
    const stage = e.target.getStage()!
    const scale = stage.scaleX()
    const sx = (pos.x - stage.x()) / scale
    const sy = (pos.y - stage.y()) / scale
    setDrawing({ x1: sx, y1: sy, x2: sx, y2: sy })
  }

  function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    if (!active || !drawing) return
    const pos = e.target.getStage()?.getPointerPosition()
    if (!pos) return
    const stage = e.target.getStage()!
    const scale = stage.scaleX()
    const sx = (pos.x - stage.x()) / scale
    const sy = (pos.y - stage.y()) / scale
    setDrawing((d) => d ? { ...d, x2: sx, y2: sy } : null)
  }

  function handleMouseUp() {
    if (!active || !drawing) return
    if (Math.abs(drawing.x2 - drawing.x1) > 2 || Math.abs(drawing.y2 - drawing.y1) > 2) {
      setLines((prev) => [...prev, { id: crypto.randomUUID(), ...drawing }])
    }
    setDrawing(null)
  }

  return (
    <Layer
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Committed lines */}
      {lines.map((l) => {
        const dist = measureDistance(l.x1, l.y1, l.x2, l.y2, state.trackScale)
        const label = unit.formatDistance(dist.metres)
        const mx = (l.x1 + l.x2) / 2
        const my = (l.y1 + l.y2) / 2
        return (
          <Group key={l.id}>
            <Line points={[l.x1, l.y1, l.x2, l.y2]} stroke="#00e5ff" strokeWidth={1.5} dash={[4, 3]} />
            <Circle x={l.x1} y={l.y1} radius={3} fill="#00e5ff" />
            <Circle x={l.x2} y={l.y2} radius={3} fill="#00e5ff" />
            <Text
              x={mx - 30} y={my - 18}
              text={label}
              fill="#00e5ff"
              fontSize={11}
              fontStyle="bold"
              onClick={() => setLines((prev) => prev.filter((ln) => ln.id !== l.id))}
            />
          </Group>
        )
      })}

      {/* In-progress line */}
      {drawing && (
        <Group>
          <Line
            points={[drawing.x1, drawing.y1, drawing.x2, drawing.y2]}
            stroke="#00e5ff"
            strokeWidth={1.5}
            dash={[4, 3]}
          />
          <Circle x={drawing.x1} y={drawing.y1} radius={3} fill="#00e5ff" />
          <Text
            x={(drawing.x1 + drawing.x2) / 2 - 30}
            y={(drawing.y1 + drawing.y2) / 2 - 18}
            text={unit.formatDistance(
              measureDistance(drawing.x1, drawing.y1, drawing.x2, drawing.y2, state.trackScale).metres,
            )}
            fill="#00e5ff"
            fontSize={11}
            fontStyle="bold"
          />
        </Group>
      )}
    </Layer>
  )
}
