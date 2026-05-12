import { useState, useEffect, useRef } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { Horse, StripePattern } from '@say-it-so/core'
import { PATTERNS, getPatternDef } from '../canvas/horsePatterns'
import { useApp } from '../../context/AppContext'

interface Props {
  horse?: Horse
  onClose: () => void
}

const EMPTY: Omit<Horse, 'id' | 'keyframes'> = {
  number: 1,
  name: '',
  jockey: '',
  stable: '',
  breeder: '',
  baseColor: '#e94560',
  stripeColor: '#ffffff',
  pattern: 'solid',
}

function PatternPreview({ pattern, base, stripe, size = 36 }: {
  pattern: StripePattern; base: string; stripe: string; size?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const r = size / 2 - 2
    ctx.clearRect(0, 0, size, size)
    getPatternDef(pattern).draw(ctx, size / 2, size / 2, r, base, stripe)
    // circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
    ctx.stroke()
  }, [pattern, base, stripe, size])
  return <canvas ref={ref} width={size} height={size} />
}

export function HorseModal({ horse, onClose }: Props) {
  const { state, dispatch } = useApp()
  const isEdit = !!horse
  const [form, setForm] = useState<Omit<Horse, 'id' | 'keyframes'>>(
    horse ? {
      number: horse.number, name: horse.name, jockey: horse.jockey,
      stable: horse.stable, breeder: horse.breeder,
      baseColor: horse.baseColor, stripeColor: horse.stripeColor, pattern: horse.pattern,
    } : { ...EMPTY, number: state.horses.length + 1 },
  )
  const [colorTarget, setColorTarget] = useState<'base' | 'stripe' | null>(null)

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
        className="bg-panel border border-border rounded-xl w-[560px] max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Edit Horse' : 'Add Horse'}</h2>

        {/* Basic info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {(
            [
              ['number', 'Number', 'number'],
              ['name', 'Name', 'text'],
              ['jockey', 'Jockey', 'text'],
              ['stable', 'Stable', 'text'],
              ['breeder', 'Breeder', 'text'],
            ] as [keyof typeof form, string, string][]
          ).map(([key, label, type]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">{label}</span>
              <input
                type={type}
                value={String(form[key])}
                onChange={(e) => set(key, type === 'number' ? Number(e.target.value) as never : e.target.value as never)}
                min={type === 'number' ? 1 : undefined}
                max={type === 'number' ? 24 : undefined}
                className="bg-surface border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
              />
            </label>
          ))}
        </div>

        {/* Colours */}
        <div className="flex gap-4 mb-4">
          {(['base', 'stripe'] as const).map((target) => (
            <div key={target} className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400 capitalize">{target} Colour</span>
              <button
                className="w-10 h-10 rounded border-2 border-border"
                style={{ background: target === 'base' ? form.baseColor : form.stripeColor }}
                onClick={() => setColorTarget(colorTarget === target ? null : target)}
              />
            </div>
          ))}
          {colorTarget && (
            <div className="ml-2">
              <HexColorPicker
                color={colorTarget === 'base' ? form.baseColor : form.stripeColor}
                onChange={(c) => set(colorTarget === 'base' ? 'baseColor' : 'stripeColor', c)}
              />
            </div>
          )}
        </div>

        {/* Pattern picker */}
        <div className="mb-4">
          <span className="text-xs text-zinc-400 block mb-2">Silhouette Pattern</span>
          <div className="grid grid-cols-8 gap-1.5 max-h-44 overflow-y-auto pr-1">
            {PATTERNS.map((p) => (
              <button
                key={p.id}
                title={p.label}
                onClick={() => set('pattern', p.id)}
                className={`rounded p-0.5 border-2 transition-colors ${form.pattern === p.id ? 'border-accent' : 'border-transparent hover:border-zinc-500'}`}
              >
                <PatternPreview pattern={p.id} base={form.baseColor} stripe={form.stripeColor} />
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 mb-5">
          <PatternPreview pattern={form.pattern} base={form.baseColor} stripe={form.stripeColor} size={52} />
          <div>
            <div className="font-semibold">{form.name || '(unnamed)'}</div>
            <div className="text-xs text-zinc-400">#{form.number} · {form.jockey || '—'}</div>
          </div>
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
