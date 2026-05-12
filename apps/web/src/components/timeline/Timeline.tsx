import { useRef, useState, useCallback } from 'react'
import type { Keyframe, EasingType } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

const LANE_H = 28
const HEADER_H = 24
const LABEL_W = 120

interface ContextMenu {
  horseId: string
  kfIndex: number
  x: number
  y: number
  easing: EasingType
}

export function Timeline() {
  const { state, dispatch } = useApp()
  const trackRef = useRef<HTMLDivElement>(null)
  const [ctx, setCtx] = useState<ContextMenu | null>(null)

  const xToTime = useCallback(
    (x: number, w: number) => Math.max(0, Math.min(state.duration, (x / w) * state.duration)),
    [state.duration],
  )

  function scrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left - LABEL_W
    const w = rect.width - LABEL_W
    dispatch({ type: 'SET_CURRENT_TIME', time: xToTime(x, w) })
  }

  const totalH = HEADER_H + state.horses.length * LANE_H

  return (
    <div className="relative select-none w-full" style={{ height: totalH }}>
      <div
        ref={trackRef}
        className="w-full h-full"
        onClick={scrubberClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Time ruler */}
        <TimeRuler duration={state.duration} labelWidth={LABEL_W} />

        {/* Horse lanes */}
        {state.horses.map((horse, i) => (
          <HorseLane
            key={horse.id}
            horseId={horse.id}
            label={`#${horse.number} ${horse.name}`}
            keyframes={horse.keyframes}
            top={HEADER_H + i * LANE_H}
            labelWidth={LABEL_W}
            onContextMenu={(kfIndex, x, y, easing) =>
              setCtx({ horseId: horse.id, kfIndex, x, y, easing })
            }
          />
        ))}

        {/* Playhead */}
        <Playhead labelWidth={LABEL_W} />
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
          onEasing={(easing) => {
            dispatch({ type: 'UPDATE_KEYFRAME_EASING', horseId: ctx.horseId, index: ctx.kfIndex, easing })
            setCtx(null)
          }}
        />
      )}
    </div>
  )
}

function TimeRuler({ duration, labelWidth }: { duration: number; labelWidth: number }) {
  const ticks = Math.min(20, Math.floor(duration / 5) + 1)
  return (
    <div
      className="absolute top-0 left-0 right-0 bg-surface border-b border-border flex items-end pb-0.5"
      style={{ height: HEADER_H, paddingLeft: labelWidth }}
    >
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const t = (i / ticks) * duration
        return (
          <div
            key={i}
            className="absolute bottom-0.5 text-zinc-500 text-[9px]"
            style={{ left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${t / duration} - 10px)` }}
          >
            {t.toFixed(0)}s
          </div>
        )
      })}
    </div>
  )
}

function HorseLane({
  horseId, label, keyframes, top, labelWidth, onContextMenu,
}: {
  horseId: string
  label: string
  keyframes: Keyframe[]
  top: number
  labelWidth: number
  onContextMenu: (kfIndex: number, x: number, y: number, easing: EasingType) => void
}) {
  const { state, dispatch } = useApp()
  const laneRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={laneRef}
      className="absolute left-0 right-0 border-b border-border/30"
      style={{ top, height: LANE_H }}
    >
      {/* Label */}
      <div
        className="absolute left-0 top-0 bottom-0 flex items-center px-2 border-r border-border bg-panel z-10 truncate text-xs"
        style={{ width: labelWidth }}
      >
        {label}
      </div>

      {/* Track area */}
      <div
        className="absolute top-0 bottom-0 right-0"
        style={{ left: labelWidth, background: 'rgba(255,255,255,0.02)' }}
      >
        {/* Keyframe diamonds */}
        {keyframes.map((kf, idx) => {
          const pct = (kf.time / state.duration) * 100
          return (
            <KeyframeDiamond
              key={idx}
              idx={idx}
              kf={kf}
              left={pct}
              onDrag={(newTime) =>
                dispatch({ type: 'UPDATE_KEYFRAME_TIME', horseId, index: idx, newTime })
              }
              onContextMenu={(x, y) => onContextMenu(idx, x, y, kf.easing)}
            />
          )
        })}
      </div>
    </div>
  )
}

function KeyframeDiamond({
  kf, left, onDrag, onContextMenu,
}: {
  idx?: number
  kf: Keyframe
  left: number
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
      const w = rect.width
      const t = Math.max(0, Math.min(state.duration, (x / w) * state.duration))
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

  const EASING_COLORS: Record<EasingType, string> = {
    'linear': '#a0a0a0',
    'ease-in': '#60a5fa',
    'ease-out': '#34d399',
    'ease-in-out': '#f59e0b',
    'cubic-bezier': '#e94560',
  }

  return (
    <div
      ref={parentRef}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 cursor-grab active:cursor-grabbing border border-white/40 hover:border-white z-10"
      style={{
        left: `${left}%`,
        background: EASING_COLORS[kf.easing] ?? '#a0a0a0',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      title={`t=${kf.time.toFixed(2)}s · ${kf.easing}`}
    />
  )
}

function Playhead({ labelWidth }: {
  labelWidth: number
}) {
  const { state, dispatch } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const fraction = state.duration > 0 ? state.currentTime / state.duration : 0

  function handleDrag(e: React.MouseEvent) {
    e.preventDefault()
    const parent = ref.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()

    function onMove(me: MouseEvent) {
      const x = me.clientX - rect.left - labelWidth
      const w = rect.width - labelWidth
      const t = Math.max(0, Math.min(state.duration, (x / w) * state.duration))
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
      style={{ left: `calc(${labelWidth}px + (100% - ${labelWidth}px) * ${fraction})` }}
    >
      {/* Draggable head */}
      <div
        className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-accent rotate-45 cursor-ew-resize pointer-events-auto"
        onMouseDown={handleDrag}
      />
    </div>
  )
}

function KeyframeContextMenu({ ctx, onClose, onDelete, onEasing }: {
  ctx: ContextMenu
  onClose: () => void
  onDelete: () => void
  onEasing: (e: EasingType) => void
}) {
  const easings: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier']
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-panel border border-border rounded-lg shadow-2xl py-1 min-w-[160px]"
        style={{ left: ctx.x, top: ctx.y, transform: 'translateY(-100%)' }}
      >
        <div className="px-3 py-1 text-xs text-zinc-400 border-b border-border mb-1">Easing</div>
        {easings.map((e) => (
          <button
            key={e}
            onClick={() => onEasing(e)}
            className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-border transition-colors ${ctx.easing === e ? 'text-accent' : ''}`}
          >
            {e}
          </button>
        ))}
        <div className="border-t border-border mt-1 pt-1">
          <button
            onClick={onDelete}
            className="block w-full text-left px-3 py-1.5 text-xs text-accent hover:bg-border transition-colors"
          >
            Delete keyframe
          </button>
        </div>
      </div>
    </>
  )
}
