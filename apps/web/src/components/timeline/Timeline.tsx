import { useRef, useState, useLayoutEffect } from 'react'
import { FiEye, FiEyeOff } from 'react-icons/fi'
import { MdNavigateBefore, MdNavigateNext } from 'react-icons/md'
import type { EaseType, Keyframe } from '@say-it-so/core'
import { interpolatePosition } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

const EASE_COLOR: Record<EaseType, string> = {
  'linear':      '#808080',
  'ease-in':     '#4a90d9',
  'ease-out':    '#52c97a',
  'ease-in-out': '#e94560',
}

const EASE_LABEL: Record<EaseType, string> = {
  'linear':      'Linear',
  'ease-in':     'Ease In',
  'ease-out':    'Ease Out',
  'ease-in-out': 'Ease In/Out',
}

const KF_SNAP = 0.05

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ startX: number; scrollLeft: number } | null>(null)
  const pendingScrollRef = useRef<number | null>(null)
  const [ctx, setCtx] = useState<ContextMenu | null>(null)
  const [zoom, setZoom] = useState(1)
  const [snapToKf, setSnapToKf] = useState(true)

  // All keyframe times across every horse — used as snap targets
  const allTimes = [...new Set(
    state.horses.flatMap(h => h.keyframes.map(k => k.time))
  )].sort((a, b) => a - b)

  function scrubberClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = innerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const t = Math.max(0, Math.min(state.duration, (x / rect.width) * state.duration))
    dispatch({ type: 'SET_CURRENT_TIME', time: t })
  }

  // After a zoom change, apply the pre-computed scrollLeft so the anchor stays put
  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScrollRef.current
      pendingScrollRef.current = null
    }
  }, [zoom])

  function zoomAround(anchorFraction: number, newZoom: number, oldZoom: number) {
    const el = scrollRef.current
    if (!el) return
    // Keep the pixel at anchorFraction stationary in the viewport
    const anchorViewportX = anchorFraction * el.clientWidth * oldZoom - el.scrollLeft
    pendingScrollRef.current = anchorFraction * el.clientWidth * newZoom - anchorViewportX
    setZoom(newZoom)
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const fraction = state.duration > 0 ? state.currentTime / state.duration : 0
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(zoom - e.deltaY * 0.005).toFixed(2)))
      zoomAround(fraction, newZoom, zoom)
    } else {
      const el = scrollRef.current
      if (el) el.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY
    }
  }

  function handlePanDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 1) return
    e.preventDefault()
    const el = scrollRef.current
    if (!el) return
    panRef.current = { startX: e.clientX, scrollLeft: el.scrollLeft }
    function onMove(me: MouseEvent) {
      if (!panRef.current || !scrollRef.current) return
      scrollRef.current.scrollLeft = panRef.current.scrollLeft - (me.clientX - panRef.current.startX)
    }
    function onUp() {
      panRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalH = HEADER_H + state.horses.length * LANE_H

  return (
    <div className="relative select-none w-full" style={{ height: totalH }}>

      {/* ── Fixed label column ─────────────────────────────────────── */}
      <div
        className="absolute left-0 top-0 bottom-0 z-20 flex flex-col border-r border-border"
        style={{ width: LABEL_W }}
      >
        {/* Corner: zoom + snap controls */}
        <div
          className="flex items-center justify-between px-2 border-b border-border bg-surface shrink-0"
          style={{ height: HEADER_H }}
        >
          {/* Snap toggle */}
          <button
            onClick={() => setSnapToKf(v => !v)}
            title={snapToKf ? 'Snap to keyframe: ON' : 'Snap to keyframe: OFF'}
            className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${
              snapToKf ? 'bg-accent/30 text-accent' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            Snap
          </button>
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => { const f = state.duration > 0 ? state.currentTime / state.duration : 0; zoomAround(f, Math.max(MIN_ZOOM, +(zoom - 0.5).toFixed(1)), zoom) }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-border transition-colors text-xs font-bold leading-none"
              title="Zoom out"
            >−</button>
            <span className="text-[9px] text-zinc-500 w-6 text-center">{zoom}×</span>
            <button
              onClick={() => { const f = state.duration > 0 ? state.currentTime / state.duration : 0; zoomAround(f, Math.min(MAX_ZOOM, +(zoom + 0.5).toFixed(1)), zoom) }}
              className="w-4 h-4 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-border transition-colors text-xs font-bold leading-none"
              title="Zoom in"
            >+</button>
          </div>
        </div>

        {/* Horse labels */}
        {state.horses.map((horse) => {
          const isSelected = state.selectedHorseId === horse.id
          const sortedKfs = [...horse.keyframes].sort((a, b) => a.time - b.time)
          const atKfIndex = sortedKfs.findIndex(k => Math.abs(k.time - state.currentTime) < KF_SNAP)
          const atKeyframe = atKfIndex >= 0

          function prevKf(e: React.MouseEvent) {
            e.stopPropagation()
            const prev = [...sortedKfs].reverse().find(k => k.time < state.currentTime - KF_SNAP)
            if (prev) dispatch({ type: 'SET_CURRENT_TIME', time: prev.time })
          }
          function nextKf(e: React.MouseEvent) {
            e.stopPropagation()
            const next = sortedKfs.find(k => k.time > state.currentTime + KF_SNAP)
            if (next) dispatch({ type: 'SET_CURRENT_TIME', time: next.time })
          }
          function toggleKf(e: React.MouseEvent) {
            e.stopPropagation()
            if (atKeyframe) {
              const origIdx = horse.keyframes.findIndex(k => Math.abs(k.time - state.currentTime) < KF_SNAP)
              if (origIdx >= 0) dispatch({ type: 'REMOVE_KEYFRAME', horseId: horse.id, index: origIdx })
            } else {
              const pos = horse.keyframes.length >= 2
                ? interpolatePosition(horse.keyframes, state.currentTime)
                : horse.keyframes.length === 1
                  ? { x: horse.keyframes[0].x, y: horse.keyframes[0].y }
                  : { x: state.canvasWidth / 2, y: state.canvasHeight / 2 }
              dispatch({ type: 'SNAPSHOT' })
              dispatch({ type: 'UPSERT_KEYFRAME', horseId: horse.id, time: state.currentTime, x: pos.x, y: pos.y })
            }
          }

          return (
            <div
              key={horse.id}
              className={`flex items-center border-b border-border/30 text-xs cursor-pointer select-none transition-colors shrink-0 ${
                isSelected ? 'bg-accent/20' : 'bg-panel hover:bg-border/40'
              }`}
              style={{ height: LANE_H }}
              onClick={() => dispatch({ type: 'SELECT_HORSE', id: isSelected ? null : horse.id })}
            >
              <span className="flex-1 truncate px-2">{`#${horse.number} ${horse.name}`}</span>

              {/* ◄ ◇ ► keyframe nav */}
              <button
                className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
                title="Previous keyframe"
                onClick={prevKf}
              >
                <MdNavigateBefore size={13} />
              </button>
              <button
                onClick={toggleKf}
                title={atKeyframe ? 'Remove keyframe at current time' : 'Add keyframe at current time'}
                className="shrink-0 px-0.5 rounded transition-colors"
              >
                <div className={`w-1.5 h-1.5 rotate-45 border ${
                  atKeyframe ? 'bg-accent border-accent' : 'bg-transparent border-zinc-600 hover:border-zinc-300'
                }`} />
              </button>
              <button
                className="shrink-0 p-0.5 rounded text-zinc-600 hover:text-zinc-300 transition-colors"
                title="Next keyframe"
                onClick={nextKf}
              >
                <MdNavigateNext size={13} />
              </button>

              {/* Eye / motion path toggle */}
              {(() => {
                const pathOn = state.motionPathHorseIds.includes(horse.id)
                return (
                  <button
                    className={`shrink-0 mr-1.5 p-0.5 rounded transition-colors ${
                      pathOn ? 'text-accent hover:text-white' : 'text-zinc-600 hover:text-zinc-300'
                    }`}
                    title={pathOn ? 'Hide motion path' : 'Show motion path'}
                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'TOGGLE_MOTION_PATHS', horseId: horse.id }) }}
                  >
                    {pathOn ? <FiEye size={11} /> : <FiEyeOff size={11} />}
                  </button>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* ── Scrollable track area ──────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="absolute top-0 bottom-0 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
        style={{ left: LABEL_W, right: 0 }}
        onWheel={handleWheel}
        onMouseDown={handlePanDown}
      >
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
              snapToKf={snapToKf}
              allTimes={allTimes}
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

// ── Track ruler ───────────────────────────────────────────────────────────────

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

// ── Horse track row ───────────────────────────────────────────────────────────

function HorseTrack({
  horseId, keyframes, top, snapToKf, allTimes, onContextMenu,
}: {
  horseId: string
  keyframes: Keyframe[]
  top: number
  snapToKf: boolean
  allTimes: number[]
  onContextMenu: (kfIndex: number, x: number, y: number) => void
}) {
  const { state, dispatch } = useApp()

  function handleDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const time = Math.max(0, Math.min(state.duration, ((e.clientX - rect.left) / rect.width) * state.duration))
    const pos = keyframes.length >= 2
      ? interpolatePosition(keyframes, time)
      : keyframes.length === 1
        ? { x: keyframes[0].x, y: keyframes[0].y }
        : { x: state.canvasWidth / 2, y: state.canvasHeight / 2 }
    dispatch({ type: 'SNAPSHOT' })
    dispatch({ type: 'UPSERT_KEYFRAME', horseId, time, x: pos.x, y: pos.y })
  }

  return (
    <div
      className="absolute left-0 right-0 border-b border-border/30"
      style={{ top, height: LANE_H, background: 'rgba(255,255,255,0.02)' }}
      onDoubleClick={handleDoubleClick}
    >
      {keyframes.map((kf, idx) => {
        const pct = (kf.time / state.duration) * 100
        const hasSpatialCurve = (
          (!!kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)) ||
          (!!kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y))
        )
        return (
          <KeyframeDiamond
            key={idx}
            kf={kf}
            left={pct}
            hasSpatialCurve={hasSpatialCurve}
            snapToKf={snapToKf}
            allTimes={allTimes}
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
  kf, left, hasSpatialCurve, snapToKf, allTimes, onDrag, onContextMenu,
}: {
  kf: Keyframe
  left: number
  hasSpatialCurve: boolean
  snapToKf: boolean
  allTimes: number[]
  onDrag: (newTime: number) => void
  onContextMenu: (x: number, y: number) => void
}) {
  const { state } = useApp()
  const parentRef = useRef<HTMLDivElement>(null)
  const [dragLeft, setDragLeft] = useState<number | null>(null)

  const displayLeft = dragLeft !== null ? dragLeft : left
  const ease = kf.ease ?? 'linear'
  const color = EASE_COLOR[ease]

  function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation()
    const parent = parentRef.current?.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const duration = state.duration
    const selfTime = kf.time
    const snapTargets = snapToKf ? allTimes.filter(t => t !== selfTime) : []

    function timeAt(me: MouseEvent) {
      const x = me.clientX - rect.left
      let t = Math.max(0, Math.min(duration, (x / rect.width) * duration))
      if (snapTargets.length > 0) {
        const snapThreshold = (8 / rect.width) * duration
        for (const candidate of snapTargets) {
          if (Math.abs(candidate - t) < snapThreshold) { t = candidate; break }
        }
      }
      return t
    }

    function onMove(me: MouseEvent) {
      const t = timeAt(me)
      setDragLeft((t / duration) * 100)
    }
    function onUp(me: MouseEvent) {
      setDragLeft(null)
      onDrag(timeAt(me))
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={parentRef}
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 cursor-grab active:cursor-grabbing border hover:border-white z-10 flex items-center justify-center"
      style={{ left: `${displayLeft}%`, background: color, borderColor: 'rgba(255,255,255,0.5)' }}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY) }}
      title={`t=${kf.time.toFixed(2)}s · ${EASE_LABEL[ease]}${hasSpatialCurve ? ' · curved path' : ''}`}
    >
      {hasSpatialCurve && (
        <div className="w-1 h-1 rounded-full bg-white opacity-80 -rotate-45 pointer-events-none" />
      )}
    </div>
  )
}

// ── Playhead ──────────────────────────────────────────────────────────────────

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

function computeAutoHandles(
  kf: Keyframe,
  prev?: Keyframe,
  next?: Keyframe,
): { cpIn: { x: number; y: number }; cpOut: { x: number; y: number } } {
  const FRAC = 0.25
  const FALLBACK = 40
  if (next && prev) {
    const dx = next.x - prev.x, dy = next.y - prev.y
    const d = Math.hypot(dx, dy) || 1
    const dn = Math.hypot(next.x - kf.x, next.y - kf.y)
    const dp = Math.hypot(prev.x - kf.x, prev.y - kf.y)
    return {
      cpOut: { x: kf.x + (dx / d) * dn * FRAC, y: kf.y + (dy / d) * dn * FRAC },
      cpIn:  { x: kf.x - (dx / d) * dp * FRAC, y: kf.y - (dy / d) * dp * FRAC },
    }
  } else if (next) {
    const cpOut = { x: kf.x + (next.x - kf.x) * FRAC, y: kf.y + (next.y - kf.y) * FRAC }
    return { cpOut, cpIn: { x: 2 * kf.x - cpOut.x, y: 2 * kf.y - cpOut.y } }
  } else if (prev) {
    const cpIn = { x: kf.x + (prev.x - kf.x) * FRAC, y: kf.y + (prev.y - kf.y) * FRAC }
    return { cpIn, cpOut: { x: 2 * kf.x - cpIn.x, y: 2 * kf.y - cpIn.y } }
  }
  return { cpOut: { x: kf.x + FALLBACK, y: kf.y }, cpIn: { x: kf.x - FALLBACK, y: kf.y } }
}

const EASE_OPTIONS: EaseType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out']

function KeyframeContextMenu({ ctx, onClose, onDelete }: {
  ctx: ContextMenu
  onClose: () => void
  onDelete: () => void
}) {
  const { state, dispatch } = useApp()
  const horse = state.horses.find(h => h.id === ctx.horseId)
  const kf = horse?.keyframes[ctx.kfIndex]

  const hasSpatialCurve = kf ? (
    (!!kf.cpOut && (kf.cpOut.x !== kf.x || kf.cpOut.y !== kf.y)) ||
    (!!kf.cpIn  && (kf.cpIn.x  !== kf.x || kf.cpIn.y  !== kf.y))
  ) : false

  const currentEase: EaseType = kf?.ease ?? 'linear'

  function handleSetEase(ease: EaseType) {
    if (!kf) return
    dispatch({ type: 'SNAPSHOT' })
    dispatch({ type: 'UPDATE_KEYFRAME_EASE', horseId: ctx.horseId, index: ctx.kfIndex,
      ease: ease === 'linear' ? undefined : ease })
    onClose()
  }

  function handleToggleCurve() {
    if (!kf || !horse) return
    dispatch({ type: 'SNAPSHOT' })
    if (hasSpatialCurve) {
      dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: ctx.horseId, index: ctx.kfIndex,
        cpIn: { x: kf.x, y: kf.y }, cpOut: { x: kf.x, y: kf.y } })
    } else {
      const sortedKfs = [...horse.keyframes].sort((a, b) => a.time - b.time)
      const pos = sortedKfs.indexOf(kf)
      const { cpIn, cpOut } = computeAutoHandles(kf, sortedKfs[pos - 1], sortedKfs[pos + 1])
      dispatch({ type: 'UPDATE_KEYFRAME_CP', horseId: ctx.horseId, index: ctx.kfIndex, cpIn, cpOut })
    }
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-panel border border-border rounded-lg shadow-2xl py-1 min-w-[170px]"
        style={{ left: ctx.x, top: ctx.y, transform: 'translateY(-100%)' }}
      >
        <div className="px-3 py-1 text-[10px] text-zinc-500 uppercase tracking-wide">Ease</div>
        {EASE_OPTIONS.map((ease) => (
          <button
            key={ease}
            onClick={() => handleSetEase(ease)}
            className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs hover:bg-border transition-colors"
          >
            <span
              className="w-2.5 h-2.5 rotate-45 shrink-0 border border-white/30"
              style={{ background: EASE_COLOR[ease] }}
            />
            <span className={currentEase === ease ? 'text-white font-medium' : 'text-zinc-300'}>
              {EASE_LABEL[ease]}
            </span>
            {currentEase === ease && <span className="ml-auto text-white">✓</span>}
          </button>
        ))}
        <div className="border-t border-border/30 my-0.5" />
        <button
          onClick={handleToggleCurve}
          className="block w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-border transition-colors"
        >
          {hasSpatialCurve ? 'Make corner path' : 'Make curved path'}
        </button>
        <div className="border-t border-border/30 my-0.5" />
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
