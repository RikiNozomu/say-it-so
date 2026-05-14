import { useRef, useState, useEffect } from 'react'
import { FiFolder, FiDownload, FiRefreshCw, FiRotateCcw, FiRotateCw, FiSettings, FiChevronDown } from 'react-icons/fi'
import { useApp } from '../../context/AppContext'
import { useSaveLoad } from '../../hooks/useSaveLoad'
import type { ActivePanel } from '../../context/actions'

const PANELS: { id: ActivePanel; label: string }[] = [
  { id: 'race',  label: 'Race'  },
  { id: 'track', label: 'Track' },
]

function FileMenu({
  icon,
  label,
  className,
  items,
}: {
  icon: React.ReactNode
  label: string
  className: string
  items: { label: string; sub?: string; onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${className}`}
      >
        {icon} {label} <FiChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-zinc-800 border border-border rounded shadow-xl">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-700 transition-colors"
            >
              <div className="text-white">{item.label}</div>
              {item.sub && <div className="text-zinc-400 text-[10px]">{item.sub}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Toolbar({ onSettingsClick }: { onSettingsClick: () => void }) {
  const { state, dispatch, canUndo, canRedo, penDrawing } = useApp()
  const { saveAll, saveTrack, saveRace, loadAll, loadTrack, loadRace } = useSaveLoad()

  return (
    <header className="flex items-center gap-3 px-4 h-12 bg-panel border-b border-border shrink-0">
      {/* Logo */}
      <span className="font-bold text-accent text-sm tracking-wider shrink-0">SAY-IT-SO</span>
      <span className="text-zinc-600 text-xs hidden sm:block">Racehorse Match Engine</span>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Project name */}
      <input
        value={state.projectName}
        onChange={(e) => dispatch({ type: 'SET_PROJECT_NAME', name: e.target.value })}
        className="bg-transparent border-b border-transparent hover:border-border focus:border-accent text-sm focus:outline-none w-40"
      />

      <div className="flex-1" />

      {/* Panel tabs */}
      <nav className="flex gap-1">
        {PANELS.map((p) => (
          <button
            key={p.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_PANEL', panel: p.id })}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              state.activePanel === p.id
                ? 'bg-accent text-white'
                : 'text-zinc-400 hover:text-white hover:bg-border'
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {/* Settings icon */}
      <button
        onClick={onSettingsClick}
        title="Settings"
        className="flex items-center justify-center w-7 h-7 border border-border rounded hover:bg-border transition-colors text-zinc-300"
      >
        <FiSettings size={13} />
      </button>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Unit toggle */}
      <button
        onClick={() => dispatch({ type: 'SET_UNITS', units: state.units === 'metric' ? 'imperial' : 'metric' })}
        className="text-xs px-2 py-1 border border-border rounded hover:bg-border transition-colors text-zinc-300"
        title="Toggle unit system"
      >
        {state.units === 'metric' ? 'km/h' : 'mph'}
      </button>

      {/* Undo / Redo */}
      <button
        onClick={() => dispatch({ type: 'UNDO' })}
        disabled={!canUndo || penDrawing}
        title="Undo (Ctrl+Z)"
        className="flex items-center justify-center w-7 h-7 border border-border rounded hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300"
      >
        <FiRotateCcw size={13} />
      </button>
      <button
        onClick={() => dispatch({ type: 'REDO' })}
        disabled={!canRedo || penDrawing}
        title="Redo (Ctrl+Shift+Z)"
        className="flex items-center justify-center w-7 h-7 border border-border rounded hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300"
      >
        <FiRotateCw size={13} />
      </button>

      {/* New */}
      <button
        onClick={() => {
          if (confirm('Start a new project? Unsaved changes will be lost.'))
            dispatch({ type: 'NEW_PROJECT' })
        }}
        className="flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-border transition-colors text-zinc-400"
        title="New project"
      >
        <FiRefreshCw size={12} /> New
      </button>

      {/* Load dropdown */}
      <FileMenu
        icon={<FiFolder size={12} />}
        label="Load"
        className="border border-border text-zinc-300 hover:bg-border"
        items={[
          { label: 'All', sub: 'Full project', onClick: loadAll },
          { label: 'Track only', onClick: loadTrack },
          { label: 'Race only', onClick: loadRace },
        ]}
      />

      {/* Save dropdown */}
      <FileMenu
        icon={<FiDownload size={12} />}
        label="Save"
        className="bg-accent hover:bg-red-500 text-white"
        items={[
          { label: 'All', sub: 'Full project', onClick: saveAll },
          { label: 'Track only', onClick: saveTrack },
          { label: 'Race only', onClick: saveRace },
        ]}
      />
    </header>
  )
}
