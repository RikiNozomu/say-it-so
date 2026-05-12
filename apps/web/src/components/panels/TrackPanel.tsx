import { useRef, useState, useEffect } from 'react'
import {
  TbPointer, TbPencil, TbRectangle,
  TbCircle, TbPolygon, TbPhoto, TbRuler,
} from 'react-icons/tb'
import { useApp } from '../../context/AppContext'
import type { ActiveTool } from '../../context/actions'
import type { RefImage, RulerUnit } from '@say-it-so/core'

const DRAW_TOOLS: { id: ActiveTool; label: string; icon: React.ReactNode }[] = [
  { id: 'select',  label: 'Select',  icon: <TbPointer size={16} /> },
  { id: 'pen',     label: 'Pen',     icon: <TbPencil size={16} /> },
  { id: 'ruler',   label: 'Ruler',   icon: <TbRuler size={16} /> },
  { id: 'rect',    label: 'Rect',    icon: <TbRectangle size={16} /> },
  { id: 'ellipse', label: 'Ellipse', icon: <TbCircle size={16} /> },
  { id: 'polygon', label: 'Polygon', icon: <TbPolygon size={16} /> },
  { id: 'image',   label: 'Image',   icon: <TbPhoto size={16} /> },
]

const RULER_UNITS: { id: RulerUnit; label: string }[] = [
  { id: 'px',  label: 'px' },
  { id: 'm',   label: 'm' },
  { id: 'mi',  label: 'mi' },
  { id: 'fur', label: 'fur' },
]

function NameInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])
  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local.trim())}
      onKeyDown={(e) => { if (e.key === 'Enter') onCommit(local.trim()) }}
      placeholder="Layer name…"
      className="w-full bg-zinc-800 border border-zinc-600 focus:border-accent rounded px-2 py-0.5 text-xs text-white outline-none"
    />
  )
}

export function TrackPanel() {
  const { state, dispatch } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleImageUpload(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        const img = new Image()
        img.onload = () => {
          const refImg: RefImage = {
            id: crypto.randomUUID(),
            name: `Image ${state.refImages.length + 1}`,
            dataUrl,
            x: 50, y: 50,
            width: Math.min(img.width, 800),
            height: Math.min(img.height, 600),
            opacity: 1,
            order: state.refImages.length,
            locked: false,
          }
          dispatch({ type: 'ADD_REF_IMAGE', image: refImg })
        }
        img.src = dataUrl
      }
      reader.readAsDataURL(file)
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const selectedShape = state.trackShapes.find((s) => s.id === state.selectedShapeId)
  const selectedImage = state.refImages.find((img) => img.id === state.selectedRefImageId)

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      {/* Drawing tools */}
      <div>
        <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Draw Tools</span>
        <div className="grid grid-cols-4 gap-1">
          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_TOOL', tool: t.id })}
              title={t.label}
              className={`flex flex-col items-center gap-0.5 py-1.5 rounded border text-xs transition-colors ${
                state.activeTool === t.id
                  ? 'bg-accent border-accent text-white'
                  : 'border-border hover:bg-border text-zinc-300'
              }`}
            >
              <span className="leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}

        </div>

        {state.activeTool === 'image' && (
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 w-full flex items-center justify-center gap-2 py-1.5 rounded border border-dashed border-accent text-accent text-xs hover:bg-accent/10 transition-colors"
          >
            <TbPhoto size={14} /> Click to upload image
          </button>
        )}

        {state.activeTool === 'polygon' && (
          <label className="flex items-center gap-2 text-xs mt-2">
            <span className="text-zinc-400 w-16 shrink-0">Sides</span>
            <input
              type="range" min={3} max={16}
              value={state.polygonSides}
              onChange={(e) => dispatch({ type: 'SET_POLYGON_SIDES', sides: Number(e.target.value) })}
              className="flex-1 min-w-0"
            />
            <span className="w-4 text-right text-zinc-300">{state.polygonSides}</span>
          </label>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleImageUpload(e.target.files)}
        />
      </div>

      {/* Edit mode hint */}
      {state.editingShapeId && (() => {
        const editShape = state.trackShapes.find((s) => s.id === state.editingShapeId)
        const editIsRuler = editShape?.type === 'ruler'
        return (
          <div className="flex flex-col gap-2">
            <div className="text-xs text-cyan-400 bg-cyan-900/30 border border-cyan-800 rounded px-2 py-1.5 leading-relaxed">
              <div className="font-semibold mb-0.5">Editing {editIsRuler ? 'ruler' : 'path'}</div>
              <div className="text-zinc-400">Drag anchor — move it</div>
              <div className="text-zinc-400">Click segment — add point</div>
              <div className="text-zinc-400">Drag segment — add curve</div>
              <div className="text-zinc-400">Click inner anchor — remove</div>
              <div className="text-zinc-400">Alt+drag handle — break symmetry</div>
              <div className="text-zinc-400">Alt+click anchor — toggle smooth/sharp</div>
              {!editIsRuler && <div className="text-zinc-400">Drag endpoint near other — close path</div>}
              <div className="text-zinc-400">Click endpoint — continue</div>
              <div className="text-zinc-400">Esc — exit edit</div>
            </div>
            {editShape?.type === 'pen' && (
              <button
                onClick={() => dispatch({
                  type: 'UPDATE_SHAPE',
                  id: editShape.id,
                  patch: editShape.closed
                    ? { closed: false }
                    : { closed: true, fillAlpha: (editShape.fillAlpha ?? 0) > 0 ? editShape.fillAlpha : 0.3 },
                })}
                className="w-full py-1.5 rounded border border-cyan-700 text-xs text-cyan-300 hover:bg-cyan-900/40 transition-colors"
              >
                {editShape.closed ? 'Open Path' : 'Close Path'}
              </button>
            )}
          </div>
        )
      })()}

      {/* Selected shape properties */}
      {selectedShape && (
        <div className="border border-border rounded p-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">
            {selectedShape.type === 'ruler' ? 'Ruler' : 'Shape'}
          </span>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Name</span>
              <NameInput
                value={selectedShape.name || ''}
                onCommit={(v) => dispatch({ type: 'UPDATE_SHAPE', id: selectedShape.id, patch: { name: v || undefined } })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Stroke</span>
              <input
                type="color"
                value={selectedShape.stroke}
                onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { stroke: e.target.value } })}
                className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent shrink-0"
              />
              <input
                type="range" min={0} max={1} step={0.01}
                value={selectedShape.strokeAlpha ?? 1}
                onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { strokeAlpha: Number(e.target.value) } })}
                className="flex-1 min-w-0"
              />
              <span className="w-7 text-right shrink-0">{Math.round((selectedShape.strokeAlpha ?? 1) * 100)}%</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Width</span>
              <input
                type="range" min={1} max={20}
                value={selectedShape.strokeWidth}
                onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { strokeWidth: Number(e.target.value) } })}
                className="flex-1 min-w-0"
              />
              <span className="w-4 text-right">{selectedShape.strokeWidth}</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Opacity</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={selectedShape.opacity ?? 1}
                onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { opacity: Number(e.target.value) } })}
                className="flex-1 min-w-0"
              />
              <span className="w-7 text-right shrink-0">{Math.round((selectedShape.opacity ?? 1) * 100)}%</span>
            </label>
            {selectedShape.type !== 'ruler' && (selectedShape.type !== 'pen' || selectedShape.closed) && (
              <label className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 w-16 shrink-0">Fill</span>
                <input
                  type="color"
                  value={selectedShape.fill && selectedShape.fill !== 'transparent' ? selectedShape.fill : '#ffffff'}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { fill: e.target.value } })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent shrink-0"
                />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={selectedShape.fillAlpha ?? 0}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { fillAlpha: Number(e.target.value) } })}
                  className="flex-1 min-w-0"
                />
                <span className="w-7 text-right shrink-0">{Math.round((selectedShape.fillAlpha ?? 0) * 100)}%</span>
              </label>
            )}
          </div>

          {/* Ruler-specific properties */}
          {selectedShape.type === 'ruler' && (
            <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
              {/* Reverse */}
              <button
                onClick={() => {
                  const anchors = selectedShape.penAnchors
                  if (!anchors || anchors.length < 2) return
                  dispatch({
                    type: 'UPDATE_SHAPE',
                    id: selectedShape.id,
                    patch: {
                      penAnchors: [...anchors].reverse().map((a) => ({
                        ...a, cpIn: a.cpOut, cpOut: a.cpIn,
                      })),
                    },
                  })
                }}
                className="w-full py-1.5 rounded border border-border text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Reverse Direction
              </button>
              {/* Unit */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 w-16 shrink-0">Unit</span>
                <div className="flex gap-1 flex-wrap">
                  {RULER_UNITS.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => dispatch({ type: 'UPDATE_SHAPE', id: selectedShape.id, patch: { rulerUnit: u.id } })}
                      className={`px-2 py-0.5 rounded text-xs transition-colors ${
                        (selectedShape.rulerUnit ?? 'm') === u.id
                          ? 'bg-accent text-white'
                          : 'bg-border text-zinc-300 hover:bg-zinc-600'
                      }`}
                    >
                      {u.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font size */}
              <label className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 w-16 shrink-0">Font size</span>
                <input
                  type="range" min={8} max={32} step={1}
                  value={selectedShape.rulerFontSize ?? 12}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerFontSize: Number(e.target.value) } })}
                  className="flex-1 min-w-0"
                />
                <span className="w-7 text-right shrink-0">{selectedShape.rulerFontSize ?? 12}px</span>
              </label>

              {/* Label text colour + opacity */}
              <label className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 w-16 shrink-0">Text</span>
                <input
                  type="color"
                  value={selectedShape.rulerLabelColor ?? '#ffffff'}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerLabelColor: e.target.value } })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent shrink-0"
                />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={selectedShape.rulerLabelColorOpacity ?? 1}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerLabelColorOpacity: Number(e.target.value) } })}
                  className="flex-1 min-w-0"
                />
                <span className="w-7 text-right shrink-0">{Math.round((selectedShape.rulerLabelColorOpacity ?? 1) * 100)}%</span>
              </label>

              {/* Label bg colour + opacity */}
              <label className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400 w-16 shrink-0">BG</span>
                <input
                  type="color"
                  value={selectedShape.rulerLabelBg ?? '#000000'}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerLabelBg: e.target.value } })}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent shrink-0"
                />
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={selectedShape.rulerLabelBgOpacity ?? 0.75}
                  onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                  onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerLabelBgOpacity: Number(e.target.value) } })}
                  className="flex-1 min-w-0"
                />
                <span className="w-7 text-right shrink-0">{Math.round((selectedShape.rulerLabelBgOpacity ?? 0.75) * 100)}%</span>
              </label>

              {/* Sequence markers */}
              <div className="pt-1.5 border-t border-border/50">
                <span className="text-xs text-zinc-500 uppercase tracking-wide block mb-1.5">Sequence</span>
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 w-16 shrink-0">Interval</span>
                  <input
                    type="number"
                    min={0} step={1}
                    value={selectedShape.rulerSeqInterval ?? 0}
                    onFocus={() => dispatch({ type: 'SNAPSHOT' })}
                    onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerSeqInterval: Number(e.target.value) } })}
                    placeholder="0 = off"
                    className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-accent"
                  />
                  <span className="text-zinc-500 shrink-0">{selectedShape.rulerUnit ?? 'm'}</span>
                </label>
                <label className="flex items-center gap-2 text-xs mt-1.5">
                  <span className="text-zinc-400 w-16 shrink-0">Color</span>
                  <input
                    type="color"
                    value={selectedShape.rulerSeqColor ?? '#ffdd00'}
                    onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                    onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerSeqColor: e.target.value } })}
                    className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent shrink-0"
                  />
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={selectedShape.rulerSeqColorOpacity ?? 1}
                    onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                    onChange={(e) => dispatch({ type: 'UPDATE_SHAPE_LIVE', id: selectedShape.id, patch: { rulerSeqColorOpacity: Number(e.target.value) } })}
                    className="flex-1 min-w-0"
                  />
                  <span className="w-7 text-right shrink-0">{Math.round((selectedShape.rulerSeqColorOpacity ?? 1) * 100)}%</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected image properties */}
      {selectedImage && (
        <div className="border border-border rounded p-2">
          <span className="text-xs text-zinc-400 uppercase tracking-wide mb-2 block">Image</span>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Name</span>
              <NameInput
                value={selectedImage.name || ''}
                onCommit={(v) => dispatch({ type: 'UPDATE_REF_IMAGE', id: selectedImage.id, patch: { name: v || undefined } })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-zinc-400 w-16 shrink-0">Opacity</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={selectedImage.opacity}
                onMouseDown={() => dispatch({ type: 'SNAPSHOT' })}
                onChange={(e) => dispatch({ type: 'UPDATE_REF_IMAGE_LIVE', id: selectedImage.id, patch: { opacity: Number(e.target.value) } })}
                className="flex-1 min-w-0"
              />
              <span className="w-8 text-right">{Math.round(selectedImage.opacity * 100)}%</span>
            </label>
          </div>
        </div>
      )}
      {state.editingShapeId && (
        <button
          onClick={() => dispatch({ type: 'SET_EDITING_SHAPE', id: null })}
          className="w-full py-2 rounded bg-accent text-white text-xs font-semibold hover:bg-accent/80 transition-colors"
        >
          Done
        </button>
      )}
    </div>
  )
}
