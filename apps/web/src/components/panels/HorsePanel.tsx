import { useState } from 'react'
import { FiEdit2, FiTrash2, FiPlus, FiCopy } from 'react-icons/fi'
import type { Horse } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'
import { HorseModal } from '../modals/HorseModal'

function HorseDot({ horse }: { horse: Horse }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
      style={{ background: horse.color, color: horse.textColor }}
    >
      {horse.number}
    </div>
  )
}

export function HorsePanel() {
  const { state, dispatch } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const [editHorse, setEditHorse] = useState<Horse | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const canAdd = state.horses.length < 24

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold">Horses ({state.horses.length}/24)</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => canAdd && setShowAdd(true)}
            disabled={!canAdd}
            className="flex items-center gap-1 text-xs px-2 py-1 bg-accent hover:bg-red-500 text-white rounded disabled:opacity-40 transition-colors"
          >
            <FiPlus size={12} /> Add
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {state.horses.length === 0 && (
          <div className="text-xs text-zinc-500 text-center mt-8 px-4">
            No horses yet. Add up to 24 horses.
          </div>
        )}
        {state.horses.map((h) => (
          <div
            key={h.id}
            onClick={() => dispatch({ type: 'SELECT_HORSE', id: state.selectedHorseId === h.id ? null : h.id })}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-border/40 border-b border-border/30 transition-colors ${
              state.selectedHorseId === h.id ? 'bg-border/60' : ''
            }`}
          >
            <HorseDot horse={h} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {h.name || <span className="text-zinc-500 italic">unnamed</span>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setEditHorse(h) }}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-border transition-colors"
                title="Edit"
              >
                <FiEdit2 size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (canAdd) dispatch({ type: 'DUPLICATE_HORSE', id: h.id }) }}
                disabled={!canAdd}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-border transition-colors disabled:opacity-30"
                title="Duplicate"
              >
                <FiCopy size={13} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(h.id) }}
                className="p-1 text-zinc-400 hover:text-accent rounded hover:bg-border transition-colors"
                title="Remove"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.selectedHorseId && (() => {
        const h = state.horses.find((x) => x.id === state.selectedHorseId)
        if (!h) return null
        return (
          <div className="px-3 py-2 border-t border-border text-xs text-zinc-400">
            {h.keyframes.length} keyframe{h.keyframes.length !== 1 ? 's' : ''} set
          </div>
        )
      })()}

      {showAdd && <HorseModal onClose={() => setShowAdd(false)} />}
      {editHorse && <HorseModal horse={editHorse} onClose={() => setEditHorse(null)} />}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-panel border border-border rounded-xl p-6 w-72 shadow-2xl">
            <p className="text-sm mb-4">Remove this horse and all its keyframes?</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm border border-border rounded hover:bg-border transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { dispatch({ type: 'REMOVE_HORSE', id: confirmDelete }); setConfirmDelete(null) }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-accent hover:bg-red-500 text-white rounded transition-colors"
              >
                <FiTrash2 size={13} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
