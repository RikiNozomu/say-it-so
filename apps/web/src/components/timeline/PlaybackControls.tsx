import {
  MdSkipPrevious, MdFastRewind, MdPlayArrow,
  MdPause, MdStop, MdFastForward, MdSkipNext,
} from 'react-icons/md'
import { usePlayback } from '../../hooks/usePlayback'
import { useApp } from '../../context/AppContext'

export function PlaybackControls() {
  const { state, dispatch } = useApp()
  const pb = usePlayback()
  const playing = state.playbackState === 'playing'
  const disabled = state.activePanel === 'track'

  const preRaceTime = state.preRaceTime
  const hasPreRace = preRaceTime > 0
  const totalTime = hasPreRace ? preRaceTime + state.duration : state.duration
  const preRacePct = hasPreRace ? (preRaceTime / totalTime) * 100 : 0
  // currentTime ranges from -preRaceTime to duration
  const currentPos = state.currentTime + preRaceTime
  const pct = totalTime > 0 ? (currentPos / totalTime) * 100 : 0

  function formatTime(s: number) {
    const abs = Math.abs(s)
    const m = Math.floor(abs / 60)
    const sec = Math.floor(abs % 60)
    const ms = Math.floor((abs % 1) * 10)
    return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}.${ms}`
  }

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (disabled) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickRatio = (e.clientX - rect.left) / rect.width
    // Map click position across the full extended timeline (-preRaceTime … duration)
    const time = clickRatio * totalTime - preRaceTime
    dispatch({ type: 'SET_CURRENT_TIME', time })
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

      {/* Speed controls */}
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

      {/* Time display — negative during pre-race */}
      <div className="font-mono text-sm text-zinc-300 shrink-0 w-20">
        {formatTime(state.currentTime)}
      </div>

      {/* Progress bar — extends left into pre-race region */}
      <div
        className="flex-1 relative h-1.5 bg-surface rounded cursor-pointer"
        onClick={handleBarClick}
      >
        {/* Pre-race background track */}
        {hasPreRace && (
          <div
            className="absolute left-0 top-0 h-full bg-zinc-600 rounded-l"
            style={{ width: `${preRacePct}%` }}
          />
        )}
        {/* Filled progress */}
        <div
          className="absolute left-0 top-0 h-full bg-accent rounded"
          style={{ width: `${pct}%` }}
        />
        {/* Divider at t=0 */}
        {hasPreRace && (
          <div
            className="absolute top-0 h-full w-px bg-zinc-400"
            style={{ left: `${preRacePct}%` }}
          />
        )}
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
