import { useRef, useState } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import type { Keyframe } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

const LANE_H = 28
const HEADER_H = 24
const LABEL_W = 200
const MIN_ZOOM = 1
const MAX_ZOOM = 10

interface ContextMenu {
  horseId: string
  kfIndex: number
  x: number
  y: number
}

export function Timeline() {
  const { state, dispatch } = useApp()
  const innerRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<ContextMenu | null>(null)
  const [zoom, setZoom] = useState(1)

  function scrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const t = Math.max(0, Math.min(state.duration, (x / rect.width) * state.duration))
    dispatch({ type: 'SET_CURRENT_TIME', time: t })
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z - e.deltaY * 0.005).toFixed(2))))
  }

  const totalH = HEADER_H + state.horses.length * LANE_H

  return (
    <div className="relative select-none w-full" style={{ height: totalH }}>

      {/* ── Fixed label column ─────────────────────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20 flex flex-col border-r border-border"
        style={{ width: LABEL_W }}
      >
        {/* Corner: zoom controls */}
        <div
          className="flex items-center justify-between px-2 border-b border-border bg-surface shrink-0"
          style={{ height: HEADER_H }}
        >
          <span className="text-[9px] text-zinc-500 font-medium">Timeline</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setZoom(z => Math.max(MIN_ZOOM, +(z - 0.5).toFixed(1)))}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-border transition-colors text-xs font-bold leading-none"
              title="Zoom out"
            >−</button>
            <span className="text-[9px] text-zinc-500 w-6 text-center">{zoom}×</span>
            <button
              onClick={() => setZoom(z => Math.min(MAX_ZOOM, +(z + 0.5).toFixed(1)))}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-border transition-colors text-xs font-bold leading-none"
              title="Zoom in"
            >+</button>
          </div>
        </div>

        {/* Horse labels */}
        {state.horses.map((horse) => {
          const isSelected = state.selectedHorseId === horse.id
          return (
            <div
              key={horse.id}
              className={`flex items-center border-b border-border/30 text-xs cursor-pointer select-none transition-colors shrink-0 ${
                isSelected ? 'bg-accent/20' : 'bg-panel hover:bg-border/40'
              }`}
              style={{ height: LANE_H }}
              onClick={() => dispatch({ type: 'SELECT_HORSE', id: horse.id })}
            >
              <span className="flex-1 truncate px-2">{`#${horse.number} ${horse.name}`}</span>
              {isSelected && (
                <button
                  className="shrink-0 mr-1.5 p-0.5 rounded text-zinc-300 hover:text-white transition-colors"
                  title={state.showMotionPaths ? 'Hide path' : 'Show path'}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MOTION_PATHS' }) }}
                >
                  {state.showMotionPaths ? <FiEye size={11} /> : <FiEyeOff size={11} />}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Scrollable track area ──────────────────────────────────── */}
      <div
        className="absolute top-0 bottom-0 overflow-x-auto"
        style={{ left: LABEL_W, right: 0 }}
        onWheel={handleWheel}
      >
        {/* Inner div: stretched by zoom, all positions are % within it */}
        <div
          ref={innerRef}
          className="relative h-full cursor-pointer"
          style={{ width: zoom === 1 ? '100%' : `${zoom * 100}%`, minWidth: '100%' }}
          onClick={scrubberClick}
        >
          <TrackRuler duration={state.duration} />

          {state.horses.map((horse, i) => (
            <HorseTrack
              key={horse.id}
              horseId={horse.id}
              keyframes={horse.keyframes}
              top={HEADER_H + i * LANE_H}
              onContextMenu={(kfIndex, x, y) =>
                setCtx({ horseId: horse.id, kfIndex, x, y })
              }
            />
          ))}

          <Playhead />
        </div>
      </div>

      {/* Context menu */}
      {ctx && (
        <KeyframeContextMenu
          ctx={ctx}
          onClose={() => setCtx(null)}
          onDelete={() => {
            dispatch({ type: 'REMOVE_KEYFRAME', horseId: ctx.horseId, index: ctx.kfIndex })
            setCtx(null)
          }}
        />
      )}
    </div>
  )
}

// ── Track ruler (inside scrollable area, no label offset) ─────────────────────

function TrackRuler({ duration }: { duration: number }) {
  const ticks = Math.min(40, Math.floor(duration) + 1)
  return (
    <div
      className="absolute top-0 left-0 right-0 bg-surface border-b border-border"
      style={{ height: HEADER_H }}
    >
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const t = (i / ticks) * duration
        return (
          <div
            key={i}
            className="absolute bottom-0.5 text-zinc-500 text-[9px]"
            style={{ left: `${(t / duration) * 100}%`, transform: 'translateX(-50%)' }}
          >
            {t.toFixed(0)}s
          </div>
        )
      })}
    </div>
  )
}

// ── Horse track row (keyframe diamonds only, no label) ────────────────────────

function HorseTrack({
  horseId, keyframes, top, onContextMenu,
}: {
  horseId: string
  keyframes: Keyframe[]
  top: number
  onContextMenu: (kfIndex: number, x: number, y: number) => void
}) {
  const { state, dispatch } = useApp()

  return (
    <div
      className="absolute left-0 right-0 border-b border-border/30"
      style={{ top, height: LANE_H, background: 'rgba(255,255,255,0.02)' }}
    >
      {keyframes.map((kf, idx) => {
        const pct = (kf.time / state.duration) * 100
        const hasCurve = (kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y))
                      || (kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y))
        return (
          <KeyframeDiamond
            key={idx}
            kf={kf}
            left={pct}
            hasCurve={!!hasCurve}
            onDrag={(newTime) =>
              dispatch({ type: 'UPDATE_KEYFRAME_TIME', horseId, index: idx, newTime })
            }
            onContextMenu={(x, y) => onContextMenu(idx, x, y)}
          />
        )
      })}
    </div>
  )
}

// ── Keyframe diamond ──────────────────────────────────────────────────────────

function KeyframeDiamond({
  kf, left, hasCurve, onDrag, onContextMenu,
}: {
  kf: Keyframe
  left: number
  hasCurve: boolean
  onDrag: (newTime: number) => void
  onContextMenu: (x: number, y: number) => void
}) {
  const { state } = useApp()
  const dragging = useRef(false)
  const parentRef = useRef<HTMLDivElement>(null)

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    dragging.current = true
    const parent = parentRef.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()

    function onMove(me: MouseEvent) {
      if (!dragging.current) return
      const x = me.clientX - rect.left
      const t = Math.max(0, Math.min(state.duration, (x / rect.width) * state.duration))
      onDrag(t)
    }
    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={parentRef}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 cursor-grab active:cursor-grabbing border hover:border-white z-10"
      style={{
        left: `${left}%`,
        background: hasCurve ? '#e94560' : '#a0a0a0',
        borderColor: hasCurve ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      title={`t=${kf.time.toFixed(2)}s${hasCurve ? ' · curved' : ''}`}
    />
  )
}

// ── Playhead (inside scrollable inner div) ────────────────────────────────────

function Playhead() {
  const { state, dispatch } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const fraction = state.duration > 0 ? state.currentTime / state.duration : 0

  function handleDrag(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const inner = ref.current?.parentElement
    if (!inner) return
    const rect = inner.getBoundingClientRect()

    function onMove(me: MouseEvent) {
      const x = me.clientX - rect.left
      const t = Math.max(0, Math.min(state.duration, (x / rect.width) * state.duration))
      dispatch({ type: 'SET_CURRENT_TIME', time: t })
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={ref}
      className="absolute top-0 bottom-0 w-px bg-accent pointer-events-none z-20"
      style={{ left: `${fraction * 100}%` }}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rotate-45 cursor-ew-resize pointer-events-auto"
        onMouseDown={handleDrag}
      />
    </div>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

function KeyframeContextMenu({ ctx, onClose, onDelete }: {
  ctx: ContextMenu
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-panel border border-border rounded-lg shadow-2xl py-1 min-w-[140px]"
        style={{ left: ctx.x, top: ctx.y, transform: 'translateY(-100%)' }}
      >
        <button
          onClick={onDelete}
          className="block w-full text-left px-3 py-1.5 text-xs text-accent hover:bg-border transition-colors"
        >
          Delete keyframe
        </button>
      </div>
    </>
  )
}
