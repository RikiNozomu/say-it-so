import { useState } from 'react'
import { FiEye, FiEyeOff, FiLock, FiUnlock, FiTrash2 } from 'react-icons/fi'
import {
  TbVectorBezier2, TbRectangle, TbCircle,
  TbPolygon, TbPhoto, TbGripVertical, TbPencil,
} from 'react-icons/tb'
import { useApp } from '../../context/AppContext'
import type { TrackShape, RefImage } from '@say-it-so/core'

// ── helpers ────────────────────────────────────────────────────────────────

type LayerItem =
  | { kind: 'shape'; data: TrackShape }
  | { kind: 'image'; data: RefImage }

function itemId(item: LayerItem) { return item.data.id }
function itemOrder(item: LayerItem) { return item.data.order }

function shapeIcon(type: TrackShape['type']) {
  switch (type) {
    case 'bezier':  return <TbVectorBezier2 size={12} />
    case 'rect':    return <TbRectangle size={12} />
    case 'ellipse': return <TbCircle size={12} />
    case 'polygon': return <TbPolygon size={12} />
    case 'pen':     return <TbPencil size={12} />
  }
}

const SHAPE_LABEL: Record<TrackShape['type'], string> = {
  bezier: 'Curve', rect: 'Rect', ellipse: 'Ellipse', polygon: 'Polygon', pen: 'Pen',
}

// ── Grip (module-level so its identity is stable across renders) ───────────

function Grip({ id, onDragEnd }: { id: string; onDragEnd: () => void }) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.setData('text/plain', id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={onDragEnd}
      onClick={(e) => e.stopPropagation()}
      className="text-zinc-500 cursor-grab active:cursor-grabbing shrink-0"
    >
      <TbGripVertical size={12} />
    </span>
  )
}

// ── LayersPanel ────────────────────────────────────────────────────────────

export function LayersPanel() {
  const { state, dispatch } = useApp()
  const [overId, setOverId] = useState<string | null>(null)

  // Unified sorted list (highest order = top of stack = first in list)
  const layers: LayerItem[] = [
    ...state.trackShapes.map((data): LayerItem => ({ kind: 'shape', data })),
    ...state.refImages.map((data): LayerItem => ({ kind: 'image', data })),
  ].sort((a, b) => itemOrder(b) - itemOrder(a))

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setOverId(id)
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    setOverId(null)
    const fromId = e.dataTransfer.getData('text/plain')
    if (!fromId || fromId === targetId) return

    // Reorder the unified list
    const items = [...layers]
    const fromIdx = items.findIndex((l) => itemId(l) === fromId)
    const toIdx   = items.findIndex((l) => itemId(l) === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    dispatch({ type: 'SNAPSHOT' })
    const [moved] = items.splice(fromIdx, 1)
    items.splice(toIdx, 0, moved)

    // Reassign orders top-to-bottom (index 0 = highest order)
    items.forEach((item, i) => {
      const order = items.length - 1 - i
      if (item.kind === 'shape') {
        dispatch({ type: 'UPDATE_SHAPE_LIVE', id: item.data.id, patch: { order } })
      } else {
        dispatch({ type: 'UPDATE_REF_IMAGE_LIVE', id: item.data.id, patch: { order } })
      }
    })
  }

  function rowClass(id: string, selected: boolean) {
    return `flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
      overId === id
        ? 'outline outline-1 outline-accent'
        : selected
        ? 'bg-accent/20 text-white'
        : 'hover:bg-border text-zinc-300'
    }`
  }

  return (
    <div className="border-t border-border shrink-0 flex flex-col overflow-hidden" style={{ maxHeight: 220 }}>
      <span className="text-xs text-zinc-400 uppercase tracking-wide px-3 pt-2 pb-1 shrink-0">Layers</span>
      <div className="flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden px-2 pb-2">
        {layers.length === 0 && (
          <p className="text-xs text-zinc-600 italic px-1">No layers yet</p>
        )}

        {layers.map((item, idx) => {
          const id = itemId(item)

          if (item.kind === 'shape') {
            const shape = item.data
            const selected = state.selectedShapeId === id
            const visible  = shape.visible !== false
            const locked   = shape.locked === true
            const displayName = shape.name || `${SHAPE_LABEL[shape.type]} ${idx + 1}`
            return (
              <div
                key={id}
                onDragOver={(e) => handleDragOver(e, id)}
                onDragLeave={() => setOverId(null)}
                onDrop={(e) => handleDrop(e, id)}
                onClick={() => dispatch({ type: 'SELECT_SHAPE', id })}
                className={`${rowClass(id, selected)} cursor-pointer`}
              >
                <Grip id={id} onDragEnd={() => setOverId(null)} />
                <span className="text-zinc-500 shrink-0">{shapeIcon(shape.type)}</span>
                <span className="flex-1 truncate">{displayName}</span>
                <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_SHAPE', id, patch: { visible: !visible } }) }} className="p-0.5 hover:text-white shrink-0">
                  {visible ? <FiEye size={11} /> : <FiEyeOff size={11} className="text-zinc-600" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_SHAPE', id, patch: { locked: !locked } }) }} className="p-0.5 hover:text-white shrink-0">
                  {locked ? <FiLock size={11} className="text-yellow-400" /> : <FiUnlock size={11} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_SHAPE', id }) }} className="p-0.5 hover:text-red-400 shrink-0">
                  <FiTrash2 size={11} />
                </button>
              </div>
            )
          }

          // image
          const img = item.data
          const selected = state.selectedRefImageId === id
          const displayName = img.name || `Image ${idx + 1}`
          return (
            <div
              key={id}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={() => setOverId(null)}
              onDrop={(e) => handleDrop(e, id)}
              onClick={() => dispatch({ type: 'SELECT_REF_IMAGE', id })}
              className={`${rowClass(id, selected)} cursor-pointer`}
            >
              <Grip id={id} onDragEnd={() => setOverId(null)} />
              <span className="text-zinc-500 shrink-0"><TbPhoto size={12} /></span>
              <span className="flex-1 truncate">{displayName}</span>
              <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_REF_IMAGE', id, patch: { visible: img.visible === false ? true : false } }) }} className="p-0.5 hover:text-white shrink-0">
                {img.visible === false ? <FiEyeOff size={11} className="text-zinc-600" /> : <FiEye size={11} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_REF_IMAGE', id, patch: { locked: !img.locked } }) }} className="p-0.5 hover:text-white shrink-0">
                {img.locked ? <FiLock size={11} className="text-yellow-400" /> : <FiUnlock size={11} />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_REF_IMAGE', id }) }} className="p-0.5 hover:text-red-400 shrink-0">
                <FiTrash2 size={11} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
