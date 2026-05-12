import { useRef, useEffect } from 'react'
import { Layer, Image as KonvaImage, Transformer } from 'react-konva'
import useImage from 'use-image'
import type Konva from 'konva'
import type { RefImage } from '@say-it-so/core'
import { useApp } from '../../context/AppContext'

function RefImageItem({ img, selected }: { img: RefImage; selected: boolean }) {
  const { dispatch } = useApp()
  const [image] = useImage(img.dataUrl)
  const nodeRef = useRef<Konva.Image>(null)
  const trRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    if (!trRef.current) return
    if (selected && nodeRef.current) {
      trRef.current.nodes([nodeRef.current])
    } else {
      trRef.current.nodes([])
    }
    trRef.current.getLayer()?.batchDraw()
  }, [selected])

  function handleDragEnd() {
    const node = nodeRef.current!
    dispatch({ type: 'UPDATE_REF_IMAGE', id: img.id, patch: { x: node.x(), y: node.y() } })
  }

  function handleTransformEnd() {
    const node = nodeRef.current!
    dispatch({
      type: 'UPDATE_REF_IMAGE',
      id: img.id,
      patch: {
        x: node.x(),
        y: node.y(),
        width: Math.max(10, node.width() * node.scaleX()),
        height: Math.max(10, node.height() * node.scaleY()),
        rotation: node.rotation(),
      },
    })
    node.scaleX(1)
    node.scaleY(1)
  }

  return (
    <>
      <KonvaImage
        ref={nodeRef}
        image={image}
        x={img.x}
        y={img.y}
        width={img.width}
        height={img.height}
        opacity={img.opacity}
        rotation={img.rotation ?? 0}
        draggable={!img.locked}
        onClick={() => dispatch({ type: 'SELECT_REF_IMAGE', id: img.id })}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      <Transformer
        ref={trRef}
        rotateEnabled={true}
        boundBoxFunc={(_, newBox) => ({
          ...newBox,
          width: Math.max(10, newBox.width),
          height: Math.max(10, newBox.height),
        })}
      />
    </>
  )
}

export function RefImageLayer() {
  const { state } = useApp()
  const sorted = [...state.refImages].sort((a, b) => a.order - b.order)
  return (
    <Layer>
      {sorted.map((img) => (
        <RefImageItem key={img.id} img={img} selected={state.selectedRefImageId === img.id} />
      ))}
    </Layer>
  )
}
