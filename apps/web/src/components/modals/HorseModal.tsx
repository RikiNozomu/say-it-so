import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { Horse } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

interface Props {
  horse?: Horse
  onClose: () => void
}

// JRA (Japan Racing Association) — 8 official bracket/cap colours, colour-only preset
const JRA_COLORS = [
  { name: 'White',  hex: '#F0F0F0', textColor: '#000000' },
  { name: 'Black',  hex: '#1A1A1A', textColor: '#ffffff' },
  { name: 'Red',    hex: '#CC0000', textColor: '#ffffff' },
  { name: 'Blue',   hex: '#003DA5', textColor: '#ffffff' },
  { name: 'Yellow', hex: '#FFD700', textColor: '#000000' },
  { name: 'Green',  hex: '#2A9050', textColor: '#ffffff' },
  { name: 'Orange', hex: '#EF6C00', textColor: '#ffffff' },
  { name: 'Pink',   hex: '#F07090', textColor: '#ffffff' },
]

// RBSC (Royal Bangkok Sports Club) — fixed number+colour pairs
// Selecting one sets both horse number and colour simultaneously
const RBSC_PRESETS = [
  { number: 1,  color: '#CC0000', textColor: '#ffffff', name: 'Red' },
  { number: 2,  color: '#FFD700', textColor: '#000000', name: 'Yellow' },
  { number: 3,  color: '#003DA5', textColor: '#ffffff', name: 'Blue' },
  { number: 4,  color: '#1A7A3C', textColor: '#ffffff', name: 'Green' },
  { number: 5,  color: '#EF6C00', textColor: '#ffffff', name: 'Orange' },
  { number: 6,  color: '#1A1A1A', textColor: '#ffffff', name: 'Black' },
  { number: 7,  color: '#6A1A8A', textColor: '#ffffff', name: 'Purple' },
  { number: 8,  color: '#F0F0F0', textColor: '#000000', name: 'White' },
  { number: 9,  color: '#E91E8C', textColor: '#ffffff', name: 'Pink' },
  { number: 10, color: '#7A4020', textColor: '#ffffff', name: 'Brown' },
  { number: 11, color: '#29B6E3', textColor: '#ffffff', name: 'Lt.Blue' },
  { number: 12, color: '#7B0000', textColor: '#ffffff', name: 'Maroon' },
  { number: 13, color: '#C2185B', textColor: '#ffffff', name: 'Fuchsia' },
  { number: 14, color: '#7B2C8F', textColor: '#ffffff', name: 'Violet' },
]

const TEXT_COLORS = ['#ffffff', '#000000', '#fef08a', '#bfdbfe', '#bbf7d0']

const EMPTY: Omit<Horse, 'id' | 'keyframes'> = {
  number: 1,
  name: '',
  color: '#CC0000',
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
  const [colorTab, setColorTab] = useState<'jra' | 'rbsc'>('jra')
  const [customTarget, setCustomTarget] = useState<'color' | 'textColor' | null>(null)

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function applyJra(hex: string, textColor: string) {
    setForm((f) => ({ ...f, color: hex, textColor }))
    setCustomTarget(null)
  }

  function applyRbsc(preset: typeof RBSC_PRESETS[number]) {
    setForm((f) => ({ ...f, number: preset.number, color: preset.color, textColor: preset.textColor }))
    setCustomTarget(null)
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

  const activeRbsc = RBSC_PRESETS.find(
    (p) => p.number === form.number && p.color.toLowerCase() === form.color.toLowerCase()
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-panel border border-border rounded-xl w-80 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Horse' : 'Add Horse'}</h2>
        </div>

        <div className="flex flex-col gap-3 px-6 overflow-y-auto flex-1">
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-zinc-400">Circle Colour</span>

            {/* Organisation tabs */}
            <div className="flex gap-1">
              {(['jra', 'rbsc'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setColorTab(tab)}
                  className={`px-2.5 py-0.5 text-xs rounded transition-colors ${
                    colorTab === tab
                      ? 'bg-accent text-white'
                      : 'border border-border text-zinc-400 hover:text-white'
                  }`}
                >
                  {tab === 'jra' ? 'JRA' : 'RBSC'}
                </button>
              ))}
            </div>

            {colorTab === 'jra' ? (
              /* JRA — 8 colour swatches, sets colour only */
              <div className="grid grid-cols-8 gap-1">
                {JRA_COLORS.map(({ name, hex, textColor }) => (
                  <button
                    key={hex}
                    title={name}
                    onClick={() => applyJra(hex, textColor)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      form.color.toLowerCase() === hex.toLowerCase()
                        ? 'border-white scale-110'
                        : 'border-transparent hover:border-zinc-400'
                    }`}
                    style={{ background: hex }}
                  />
                ))}
              </div>
            ) : (
              /* RBSC — 14 number+colour pairs, sets both number and colour */
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] text-zinc-500 mb-0.5">
                  Selecting a preset will also update the horse number.
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {RBSC_PRESETS.map((preset) => {
                    const isActive = activeRbsc?.number === preset.number
                    return (
                      <button
                        key={preset.number}
                        title={`No.${preset.number} — ${preset.name}`}
                        onClick={() => applyRbsc(preset)}
                        className={`flex items-center gap-2 px-2 py-1 rounded transition-colors text-left ${
                          isActive
                            ? 'bg-accent/20 border border-accent'
                            : 'border border-border hover:bg-surface'
                        }`}
                      >
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{ background: preset.color, color: preset.textColor }}
                        >
                          {preset.number}
                        </span>
                        <span className="text-xs text-zinc-300 truncate">{preset.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Custom picker */}
            <button
              onClick={() => setCustomTarget(customTarget === 'color' ? null : 'color')}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white mt-0.5"
            >
              <span className="w-5 h-5 rounded-full border border-border shrink-0" style={{ background: form.color }} />
              Custom…
            </button>
            {customTarget === 'color' && (
              <div className="mt-1">
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
              <span className="w-5 h-5 rounded-full border border-border shrink-0" style={{ background: form.textColor }} />
              Custom…
            </button>
            {customTarget === 'textColor' && (
              <div className="mt-2">
                <HexColorPicker color={form.textColor} onChange={(c) => set('textColor', c)} />
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 pt-1 pb-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
              style={{ background: form.color, color: form.textColor }}
            >
              {form.number}
            </div>
            <div className="font-semibold">{form.name || '(unnamed)'}</div>
          </div>
        </div>

        <div className="flex gap-2 justify-end px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded border border-border hover:bg-border transition-colors">Cancel</button>
          <button onClick={submit} className="px-4 py-1.5 text-sm rounded bg-accent hover:bg-red-500 text-white transition-colors">
            {isEdit ? 'Save' : 'Add Horse'}
          </button>
        </div>
      </div>
    </div>
  )
}
