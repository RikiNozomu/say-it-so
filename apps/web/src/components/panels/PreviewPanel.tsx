import { FiEye, FiEyeOff } from 'react-icons/fi'
import { interpolatePosition } from '@say-it-so/core'
import type { Horse } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

interface PreviewPanelProps {
  onStartRace: () => void
}

function computeSpeed(horse: Horse, currentTime: number, trackScale: number, units: 'metric' | 'imperial'): number {
  const DELTA = 0.05
  const p1 = interpolatePosition(horse.keyframes, currentTime)
  const p2 = interpolatePosition(horse.keyframes, currentTime + DELTA)
  const px = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2)
  const mPerSec = (px / DELTA) / trackScale
  return units === 'metric' ? mPerSec * 3.6 : mPerSec * 2.237
}

export function PreviewPanel({ onStartRace }: PreviewPanelProps) {
  const { state, dispatch } = useApp()
  const sorted = [...state.horses].sort((a, b) => a.number - b.number)

  return (
    <div className="flex flex-col h-full">
      {/* Horse list */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-1">
        {sorted.map((horse) => {
          const speed = computeSpeed(horse, state.currentTime, state.trackScale, state.units)
          const showName = state.previewHorseNameIds.includes(horse.id)
          return (
            <div
              key={horse.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              {/* Color dot with number */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: horse.color, color: horse.textColor }}
              >
                {horse.number}
              </div>

              {/* Name + speed */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{horse.name || `Horse ${horse.number}`}</div>
                <div className="text-[10px] text-zinc-400">
                  {speed.toFixed(1)} {state.units === 'metric' ? 'km/h' : 'mph'}
                </div>
              </div>

              {/* Name label toggle */}
              <button
                onClick={() => dispatch({ type: 'TOGGLE_PREVIEW_HORSE_NAME', horseId: horse.id })}
                title={showName ? 'Hide name on canvas' : 'Show name on canvas'}
                className={`shrink-0 p-1 rounded transition-colors ${
                  showName ? 'text-accent' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {showName ? <FiEye size={13} /> : <FiEyeOff size={13} />}
              </button>
            </div>
          )
        })}
      </div>

      {/* Pre-race time + start */}
      <div className="shrink-0 border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-zinc-400 shrink-0">Countdown (s)</label>
          <input
            type="number"
            min={0}
            max={60}
            value={state.preRaceTime}
            onChange={(e) => dispatch({ type: 'SET_PRE_RACE_TIME', seconds: Number(e.target.value) })}
            className="w-full bg-zinc-800 border border-border rounded text-xs text-white px-2 py-1 focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={onStartRace}
          className="w-full py-1.5 rounded bg-accent hover:bg-red-500 text-white text-sm font-semibold transition-colors"
        >
          Start Race
        </button>
      </div>
    </div>
  )
}
