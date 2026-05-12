import { FiFolder, FiDownload, FiRefreshCw, FiRotateCcw, FiRotateCw, FiSettings } from 'react-icons/fi'
import { useApp } from '../../context/AppContext'
import { useSaveLoad } from '../../hooks/useSaveLoad'
import type { ActivePanel } from '../../context/actions'

const PANELS: { id: ActivePanel; label: string }[] = [
  { id: 'horses', label: 'Horses' },
  { id: 'track',  label: 'Track'  },
]

export function Toolbar({ onSettingsClick }: { onSettingsClick: () => void }) {
  const { state, dispatch, canUndo, canRedo, penDrawing } = useApp()
  const { save, load } = useSaveLoad()

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

      {/* New / Load / Save */}
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
      <button
        onClick={load}
        className="flex items-center gap-1 text-xs px-2 py-1 border border-border rounded hover:bg-border transition-colors text-zinc-300"
        title="Load project"
      >
        <FiFolder size={12} /> Load
      </button>
      <button
        onClick={save}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-accent hover:bg-red-500 text-white rounded transition-colors"
        title="Save project"
      >
        <FiDownload size={12} /> Save
      </button>
    </header>
  )
}
