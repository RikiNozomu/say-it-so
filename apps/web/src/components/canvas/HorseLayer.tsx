import { Layer, Group, Circle, Text } from 'react-konva'
import type { Horse } from '@say-it-so/core'
import { interpolatePosition } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

// Standard racehorse body ≈ 2.4 m long; marker radius = half that, clamped 8–48 px
const HORSE_LENGTH_M = 2.4
const BORDER = 2

function horseRadius(trackScale: number) {
  return Math.max(8, Math.min(48, Math.round(trackScale * HORSE_LENGTH_M / 2)))
}

interface HorseMarkerProps {
  horse: Horse
  x: number
  y: number
  selected: boolean
}

function HorseMarker({ horse, x, y, selected }: HorseMarkerProps) {
  const { dispatch, state } = useApp()
  const r = horseRadius(state.trackScale)

  return (
    <Group
      x={x}
      y={y}
      draggable={state.playbackState !== 'playing' && state.activePanel === 'race'}
      onDragEnd={(e) => {
        if (state.activePanel !== 'race') return
        dispatch({
          type: 'UPSERT_KEYFRAME',
          horseId: horse.id,
          time: state.currentTime,
          x: e.target.x(),
          y: e.target.y(),
        })
      }}
      onClick={() => {
        if (state.activePanel !== 'race') return
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

      {/* Solid colour circle */}
      <Circle
        radius={r}
        fill={horse.color}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1}
        listening={false}
      />

      {/* Number */}
      <Text
        text={String(horse.number)}
        fontSize={r * 0.9}
        fontStyle="bold"
        fill={horse.textColor}
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

      {/* Name label — preview mode only */}
      {state.activePanel === 'preview' && state.previewHorseNameIds.includes(horse.id) && (
        <Text
          text={horse.name}
          fontSize={11}
          fill="white"
          align="center"
          width={120}
          x={-60}
          y={r + BORDER + 4}
          listening={false}
          shadowColor="#000"
          shadowBlur={4}
        />
      )}
    </Group>
  )
}

export function HorseLayer() {
  const { state } = useApp()

  if (state.activePanel === 'track') return null

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
