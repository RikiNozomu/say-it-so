import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { Horse } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

interface Props {
  horse?: Horse
  onClose: () => void
}

const BG_COLORS = [
  '#e94560', '#3b82f6', '#22c55e', '#f59e0b',
  '#a855f7', '#ec4899', '#14b8a6', '#f97316',
]

const TEXT_COLORS = ['#ffffff', '#000000', '#fef08a', '#bfdbfe', '#bbf7d0']

const EMPTY: Omit<Horse, 'id' | 'keyframes'> = {
  number: 1,
  name: '',
  color: '#e94560',
  textColor: '#ffffff',
}

export function HorseModal({ horse, onClose }: Props) {
  const { state, dispatch } = useApp()
  const isEdit = !!horse
  const [form, setForm] = useState<Omit<Horse, 'id' | 'keyframes'>>(
    horse
      ? { number: horse.number, name: horse.name, color: horse.color, textColor: horse.textColor }
      : { ...EMPTY, number: state.horses.length + 1 },
  )
  const [customTarget, setCustomTarget] = useState<'color' | 'textColor' | null>(null)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function submit() {
    if (!form.name.trim()) return
    if (isEdit) {
      dispatch({ type: 'UPDATE_HORSE', id: horse!.id, patch: form })
    } else {
      dispatch({
        type: 'ADD_HORSE',
        horse: { ...form, id: crypto.randomUUID(), keyframes: [] },
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-xl w-80 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit Horse' : 'Add Horse'}</h2>

        <div className="flex flex-col gap-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Number</span>
            <input
              type="number"
              value={form.number}
              onChange={(e) => set('number', Number(e.target.value))}
              min={1} max={24}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
          </label>

          {/* Circle colour */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Circle Colour</span>
            <div className="flex gap-1.5 flex-wrap mb-1">
              {BG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('color', c)}
                  className={`w-7 h-7 rounded-full border-2 transition-colors ${form.color === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <button
              onClick={() => setCustomTarget(customTarget === 'color' ? null : 'color')}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
            >
              <span className="w-5 h-5 rounded-full border border-border" style={{ background: form.color }} />
              Custom…
            </button>
            {customTarget === 'color' && (
              <div className="mt-2">
                <HexColorPicker color={form.color} onChange={(c) => set('color', c)} />
              </div>
            )}
          </div>

          {/* Text colour */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-400">Text Colour</span>
            <div className="flex gap-1.5 flex-wrap mb-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => set('textColor', c)}
                  className={`w-7 h-7 rounded-full border-2 transition-colors ${form.textColor === c ? 'border-accent' : 'border-border'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <button
              onClick={() => setCustomTarget(customTarget === 'textColor' ? null : 'textColor')}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white"
            >
              <span className="w-5 h-5 rounded-full border border-border" style={{ background: form.textColor }} />
              Custom…
            </button>
            {customTarget === 'textColor' && (
              <div className="mt-2">
                <HexColorPicker color={form.textColor} onChange={(c) => set('textColor', c)} />
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            style={{ background: form.color, color: form.textColor }}
          >
            {form.number}
          </div>
          <div className="font-semibold">{form.name || '(unnamed)'}</div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-border hover:bg-border transition-colors">Cancel</button>
          <button onClick={submit} className="px-4 py-1.5 text-sm rounded bg-accent hover:bg-red-500 text-white transition-colors">
            {isEdit ? 'Save' : 'Add Horse'}
          </button>
        </div>
      </div>
    </div>
  )
}
