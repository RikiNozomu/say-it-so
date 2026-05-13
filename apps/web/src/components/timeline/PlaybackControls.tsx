import {
  MdSkipPrevious, MdFastRewind, MdPlayArrow,
  MdPause, MdStop, MdFastForward, MdSkipNext,
  MdNavigateBefore, MdNavigateNext,
} from 'react-icons/md'
import { usePlayback } from '../../hooks/usePlayback'
import { useApp } from '../../context/AppContext'
import { interpolatePosition } from '@say-it-so/core'

const KF_SNAP = 0.05  // seconds threshold for "at a keyframe"

export function PlaybackControls() {
  const { state, dispatch } = useApp()
  const pb = usePlayback()
  const playing = state.playbackState === 'playing'
  const pct = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0
  const disabled = state.activePanel === 'track'

  // ── Keyframe navigation helpers ───────────────────────────────────────────
  const selectedHorse = state.horses.find(h => h.id === state.selectedHorseId)
  const sortedKfs = selectedHorse
    ? [...selectedHorse.keyframes].sort((a, b) => a.time - b.time)
    : []
  const atKfIndex = sortedKfs.findIndex(k => Math.abs(k.time - state.currentTime) < KF_SNAP)
  const atKeyframe = atKfIndex >= 0

  function prevKeyframe() {
    const prev = [...sortedKfs].reverse().find(k => k.time < state.currentTime - KF_SNAP)
    if (prev) dispatch({ type: 'SET_CURRENT_TIME', time: prev.time })
  }
  function nextKeyframe() {
    const next = sortedKfs.find(k => k.time > state.currentTime + KF_SNAP)
    if (next) dispatch({ type: 'SET_CURRENT_TIME', time: next.time })
  }
  function toggleKeyframe() {
    if (!selectedHorse) return
    if (atKeyframe) {
      // Find the actual index in the original (unsorted) array
      const origIdx = selectedHorse.keyframes.findIndex(
        k => Math.abs(k.time - state.currentTime) < KF_SNAP
      )
      if (origIdx >= 0) dispatch({ type: 'REMOVE_KEYFRAME', horseId: selectedHorse.id, index: origIdx })
    } else {
      // Create keyframe at current time using interpolated position
      const pos = selectedHorse.keyframes.length >= 2
        ? interpolatePosition(selectedHorse.keyframes, state.currentTime)
        : selectedHorse.keyframes.length === 1
          ? { x: selectedHorse.keyframes[0].x, y: selectedHorse.keyframes[0].y }
          : { x: state.canvasWidth / 2, y: state.canvasHeight / 2 }
      dispatch({ type: 'SNAPSHOT' })
      dispatch({ type: 'UPSERT_KEYFRAME', horseId: selectedHorse.id, time: state.currentTime, x: pos.x, y: pos.y })
    }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    const ms = Math.floor((s % 1) * 10)
    return `${m}:${String(sec).padStart(2, '0')}.${ms}`
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-panel border-b border-border shrink-0">
      {/* Controls */}
      <div className={`flex items-center gap-0.5 shrink-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
        <CtrlBtn title="Rewind to start" onClick={pb.rewind}><MdSkipPrevious size={18} /></CtrlBtn>
        <CtrlBtn title="Skip back 5s" onClick={pb.skipBack}><MdFastRewind size={18} /></CtrlBtn>
        <CtrlBtn title={playing ? 'Pause' : 'Play'} onClick={playing ? pb.pause : pb.play} accent>
          {playing ? <MdPause size={20} /> : <MdPlayArrow size={20} />}
        </CtrlBtn>
        <CtrlBtn title="Stop" onClick={pb.stop}><MdStop size={18} /></CtrlBtn>
        <CtrlBtn title="Skip forward 5s" onClick={pb.skipForward}><MdFastForward size={18} /></CtrlBtn>
        <CtrlBtn title="Jump to end" onClick={pb.fastForward}><MdSkipNext size={18} /></CtrlBtn>
      </div>

      {/* ◄ ◇ ► Keyframe navigation — horse mode only */}
      {state.activePanel === 'horses' && (
        <div className="flex items-center gap-0.5 shrink-0 border-l border-border pl-3">
          <CtrlBtn title="Previous keyframe" onClick={prevKeyframe} disabled={!selectedHorse}>
            <MdNavigateBefore size={18} />
          </CtrlBtn>
          <button
            onClick={toggleKeyframe}
            disabled={!selectedHorse}
            title={atKeyframe ? 'Remove keyframe at current time' : 'Add keyframe at current time'}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-30 ${
              atKeyframe
                ? 'text-accent hover:bg-border'
                : 'text-zinc-400 hover:bg-border hover:text-white'
            }`}
          >
            {/* Rotated square = diamond shape */}
            <div className={`w-3 h-3 rotate-45 border ${
              atKeyframe
                ? 'bg-accent border-accent'
                : 'bg-transparent border-zinc-400'
            }`} />
          </button>
          <CtrlBtn title="Next keyframe" onClick={nextKeyframe} disabled={!selectedHorse}>
            <MdNavigateNext size={18} />
          </CtrlBtn>
        </div>
      )}

      {/* Speed controls: preset buttons + fine slider */}
      <div className={`flex items-center gap-1.5 shrink-0 ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            onClick={() => dispatch({ type: 'SET_PLAYBACK_SPEED', speed: s })}
            className={`px-2 h-7 rounded text-xs transition-colors ${
              state.playbackSpeed === s
                ? 'bg-accent text-white'
                : 'text-zinc-400 hover:bg-border hover:text-white'
            }`}
          >
            {s}×
          </button>
        ))}
        <input
          type="range" min={0.25} max={4} step={0.25}
          value={state.playbackSpeed}
          onChange={(e) => dispatch({ type: 'SET_PLAYBACK_SPEED', speed: Number(e.target.value) })}
          className="w-20"
          title={`${state.playbackSpeed}×`}
        />
        <span className="text-xs text-zinc-500 w-6">{state.playbackSpeed}×</span>
      </div>

      {/* Time display */}
      <div className="font-mono text-sm text-zinc-300 shrink-0 w-20">
        {formatTime(state.currentTime)}
      </div>

      {/* Progress bar / mini scrubber */}
      <div
        className="flex-1 relative h-1.5 bg-surface rounded cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const time = ((e.clientX - rect.left) / rect.width) * state.duration
          dispatch({ type: 'SET_CURRENT_TIME', time })
        }}
      >
        <div
          className="absolute left-0 top-0 h-full bg-accent rounded"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="font-mono text-sm text-zinc-500 shrink-0 w-20 text-right">
        {formatTime(state.duration)}
      </div>
    </div>
  )
}

function CtrlBtn({
  children, onClick, title, accent, disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  title?: string
  accent?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`w-8 h-8 flex items-center justify-center rounded transition-colors disabled:opacity-30 ${
        accent
          ? 'bg-accent hover:bg-red-500 text-white'
          : 'text-zinc-300 hover:bg-border hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
