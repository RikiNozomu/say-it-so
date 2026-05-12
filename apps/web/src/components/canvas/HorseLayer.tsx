import { Layer, Group, Circle, Text, Shape } from 'react-konva'
import type { Horse } from '@say-it-so/core'
import { interpolatePosition } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'
import { getPatternDef } from './horsePatterns'
import type Konva from 'konva'

const RADIUS = 18
const BORDER = 2

interface HorseMarkerProps {
  horse: Horse
  x: number
  y: number
  selected: boolean
}

function HorseMarker({ horse, x, y, selected }: HorseMarkerProps) {
  const { dispatch, state } = useApp()
  const r = RADIUS

  return (
    <Group
      x={x}
      y={y}
      draggable={state.playbackState !== 'playing' && state.activePanel === 'horses'}
      onDragEnd={(e) => {
        if (state.activePanel !== 'horses') return
        dispatch({
          type: 'UPSERT_KEYFRAME',
          horseId: horse.id,
          time: state.currentTime,
          x: e.target.x(),
          y: e.target.y(),
        })
      }}
      onClick={() => {
        if (state.activePanel !== 'horses') return
        dispatch({ type: 'SELECT_HORSE', id: horse.id })
      }}
    >
      {/* Selection ring */}
      <Circle
        radius={r + BORDER + 2}
        stroke={selected ? '#e94560' : 'rgba(255,255,255,0.25)'}
        strokeWidth={selected ? 2.5 : 1}
        fill="transparent"
      />

      {/* Pattern drawn via sceneFunc */}
      <Shape
        sceneFunc={(ctx: Konva.Context) => {
          const def = getPatternDef(horse.pattern)
          def.draw(ctx._context as unknown as CanvasRenderingContext2D, 0, 0, r, horse.baseColor, horse.stripeColor)
          // white border circle
          ctx._context.strokeStyle = 'rgba(255,255,255,0.4)'
          ctx._context.lineWidth = 1
          ctx._context.beginPath()
          ctx._context.arc(0, 0, r, 0, Math.PI * 2)
          ctx._context.stroke()
        }}
        width={r * 2}
        height={r * 2}
        offsetX={r}
        offsetY={r}
        listening={false}
      />

      {/* Number */}
      <Text
        text={String(horse.number)}
        fontSize={r * 0.9}
        fontStyle="bold"
        fill="#fff"
        shadowColor="#000"
        shadowBlur={3}
        align="center"
        verticalAlign="middle"
        width={r * 2}
        height={r * 2}
        offsetX={r}
        offsetY={r}
        listening={false}
      />
    </Group>
  )
}

export function HorseLayer() {
  const { state } = useApp()

  return (
    <Layer>
      {state.horses.map((horse) => {
        const pos = interpolatePosition(horse.keyframes, state.currentTime)
        return (
          <HorseMarker
            key={horse.id}
            horse={horse}
            x={pos.x}
            y={pos.y}
            selected={state.selectedHorseId === horse.id}
          />
        )
      })}
    </Layer>
  )
}
