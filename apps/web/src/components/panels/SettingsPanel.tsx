import { useApp } from '../../context/AppContext'
import { measureHorseSpeed } from '@say-it-so/core'
import { useUnit } from '../../hooks/useUnit'

export function SettingsPanel() {
  const { state, dispatch } = useApp()
  useUnit() // side-effect: keeps unit context active

  const selectedHorse = state.horses.find((h) => h.id === state.selectedHorseId)

  return (
    <div className="flex flex-col gap-4 p-3 h-full overflow-y-auto">
      {/* Project */}
      <section>
        <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Project</span>
        <label className="flex flex-col gap-1 mb-2">
          <span className="text-xs text-zinc-400">Name</span>
          <input
            value={state.projectName}
            onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
            className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 mb-2">
          <span className="text-xs text-zinc-400">Duration (seconds)</span>
          <input
            type="number" min={10} max={3600}
            value={state.duration}
            onChange={(e) => dispatch({ type: 'SET_DURATION', duration: Number(e.target.value) })}
            className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Track Scale (px/metre)</span>
          <input
            type="number" min={1} max={100} step={0.5}
            value={state.trackScale}
            onChange={(e) => dispatch({ type: 'SET_TRACK_SCALE', scale: Number(e.target.value) })}
            className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
          <span className="text-xs text-zinc-600">
            1 px = {(1 / state.trackScale).toFixed(2)} m
          </span>
        </label>
      </section>

      {/* Units */}
      <section>
        <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Unit System</span>
        <div className="flex gap-2">
          {(['metric', 'imperial'] as const).map((u) => (
            <button
              key={u}
              onClick={() => dispatch({ type: 'SET_UNITS', units: u })}
              className={`flex-1 py-1.5 text-sm rounded border transition-colors ${state.units === u ? 'bg-accent border-accent text-white' : 'border-border hover:bg-border'}`}
            >
              {u === 'metric' ? 'Metric (m/km)' : 'Imperial (ft/mi)'}
            </button>
          ))}
        </div>
      </section>

      {/* Speed calculator */}
      <section>
        <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Speed Calculator</span>
        {!selectedHorse ? (
          <p className="text-xs text-zinc-500 italic">Select a horse to calculate speed</p>
        ) : (
          <SpeedCalc horse={selectedHorse} />
        )}
      </section>

      {/* Canvas size */}
      <section>
        <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Canvas Size</span>
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-zinc-400">Width</span>
            <input
              type="number" min={400} max={8000}
              value={state.canvasWidth}
              onChange={() => dispatch({ type: 'SET_TRACK_SCALE', scale: state.trackScale })}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1">
            <span className="text-xs text-zinc-400">Height</span>
            <input
              type="number" min={300} max={4000}
              value={state.canvasHeight}
              onChange={() => dispatch({ type: 'SET_TRACK_SCALE', scale: state.trackScale })}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
          </label>
        </div>
      </section>
    </div>
  )
}

function SpeedCalc({ horse }: { horse: { id: string; keyframes: { time: number; x: number; y: number }[]; name: string } }) {
  const { state } = useApp()
  const unit = useUnit()

  if (horse.keyframes.length < 2) {
    return <p className="text-xs text-zinc-500 italic">Need at least 2 keyframes</p>
  }

  const sorted = [...horse.keyframes].sort((a, b) => a.time - b.time)
  const t1 = sorted[0].time
  const t2 = sorted[sorted.length - 1].time
  const speed = measureHorseSpeed(horse.keyframes, t1, t2, state.trackScale)

  return (
    <div className="text-xs space-y-1">
      <div className="text-zinc-300">{horse.name}</div>
      <div className="flex justify-between">
        <span className="text-zinc-400">Avg Speed</span>
        <span className="text-cyan-300 font-mono">{unit.formatSpeed(speed.metresPerSecond)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-zinc-400">Over</span>
        <span className="font-mono">{(t2 - t1).toFixed(1)}s</span>
      </div>
      <p className="text-zinc-600 text-xs mt-1">Select a time range on the timeline for a segment speed.</p>
    </div>
  )
}
